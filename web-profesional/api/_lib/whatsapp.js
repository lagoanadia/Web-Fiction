/* =============================================================
   Conexión con WhatsApp (WhatsApp Cloud API de Meta)
   Variables de entorno (en Vercel, nunca en el código):
     WHATSAPP_TOKEN         token de acceso permanente (usuario del sistema)
     WHATSAPP_PHONE_ID      "Phone number ID" del número del negocio
     WHATSAPP_VERIFY_TOKEN  palabra secreta que inventas tú para el webhook
     WHATSAPP_APP_SECRET    "App secret" de la app de Meta (firma los avisos)
   Solo usa fetch y crypto, que ya vienen con Node: sin librerías.
   ============================================================= */
import crypto from 'node:crypto';
import { query } from './db.js';

// Versión de la API de Meta. Cada versión dura unos 2 años: cuando Meta
// avise de que caduca, cambia el número aquí (el formato no suele cambiar).
const API = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';

export const whatsappConfigurado = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID &&
          process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET);

/** Meta firma cada aviso con el App secret: así sabemos que viene de Meta y no de cualquiera */
export function firmaValida(crudo, cabecera) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || typeof cabecera !== 'string' || !cabecera.startsWith('sha256=')) return false;
  const esperada = Buffer.from('sha256=' + crypto.createHmac('sha256', secreto).update(crudo).digest('hex'));
  const recibida = Buffer.from(cabecera);
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

/* WhatsApp limita el largo de cada parte de un mensaje interactivo.
   Si nos pasamos, rechaza el mensaje entero: por eso se recorta todo. */
const corta = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/** Convierte nuestro formato sencillo al formato de la API:
      { texto }                                   → mensaje normal
      { texto, botones: [{ id, titulo }] }         → hasta 3 botones
      { texto, lista: { boton, filas: [{ id, titulo, descripcion }] } } → menú de hasta 10 opciones */
function aFormatoMeta(para, m) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: para };
  if (m.botones) {
    return { ...base, type: 'interactive', interactive: {
      type: 'button',
      body: { text: corta(m.texto, 1024) },
      action: { buttons: m.botones.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: corta(b.titulo, 20) } })) }
    } };
  }
  if (m.lista) {
    return { ...base, type: 'interactive', interactive: {
      type: 'list',
      body: { text: corta(m.texto, 1024) },
      action: {
        button: corta(m.lista.boton, 20),
        sections: [{ title: corta(m.lista.seccion || 'Opciones', 24), rows: m.lista.filas.slice(0, 10).map(f => ({
          id: f.id, title: corta(f.titulo, 24), ...(f.descripcion ? { description: corta(f.descripcion, 72) } : {})
        })) }]
      }
    } };
  }
  return { ...base, type: 'text', text: { body: corta(m.texto, 4096), preview_url: false } };
}

/** Texto que se guarda en el historial (lo que verá Nadia en el panel) */
function textoHistorial(m) {
  if (m.botones) return `${m.texto}\n[${m.botones.map(b => b.titulo).join('] [')}]`;
  if (m.lista) return `${m.texto}\n[${m.lista.boton}: ${m.lista.filas.map(f => f.titulo).join(', ')}]`;
  return m.texto;
}

/** Envía un mensaje y lo guarda en el historial. autor: 'bot' o 'nadia' */
export async function enviarWhatsApp(para, mensaje, autor = 'bot') {
  let r;
  try {
    r = await fetch(`${API}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(aFormatoMeta(para, mensaje)),
      signal: AbortSignal.timeout(8000) // si Meta no responde, no esperar eternamente
    });
  } catch (e) {
    throw Object.assign(new Error('No se ha podido conectar con WhatsApp.'), { code: 'WA_API' });
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(datos.error?.message || `WhatsApp respondió ${r.status}`);
    e.code = 'WA_API';
    e.waCode = datos.error?.code; // 131047 = han pasado más de 24 h desde el último mensaje del cliente
    throw e;
  }
  await query('INSERT INTO wa_mensajes (telefono, autor, texto, wa_id) VALUES ($1, $2, $3, $4)',
    [para, autor, textoHistorial(mensaje), datos.messages?.[0]?.id || null]);
  return datos;
}
