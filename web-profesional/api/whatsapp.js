/* =============================================================
   /api/whatsapp  (webhook de WhatsApp — lo llama Meta, no la web)
   GET  → Meta comprueba que el webhook es tuyo (una sola vez, al configurarlo)
   POST → Meta avisa de cada mensaje que recibe el número del negocio.
          Se comprueba la firma, se guarda el mensaje y el bot contesta.
   ============================================================= */
import crypto from 'node:crypto';
import { query } from './_lib/db.js';
import { cuerpoCrudo, parametros } from './_lib/http.js';
import { whatsappConfigurado, firmaValida, enviarWhatsApp } from './_lib/whatsapp.js';
import { responder, temaDe, pareceGallego, saludo } from './_lib/bot.js';

// Para comprobar la firma hace falta el cuerpo EXACTO que envió Meta,
// así que le pedimos a Vercel que no lo convierta a JSON.
export const config = { api: { bodyParser: false } };

const HORAS_HUMANO = 24;  // tras "Hablar con Nadia", el bot calla durante este tiempo
const MINUTOS_PASO = 120; // una reserva a medias se olvida tras 2 horas sin respuesta

export default async function handler(req, res) {
  if (req.method === 'GET') return verificar(req, res);
  if (req.method !== 'POST') return responderTexto(res, 405, '');
  if (!whatsappConfigurado()) return responderTexto(res, 503, 'WhatsApp no configurado');

  const crudo = await cuerpoCrudo(req);
  if (!firmaValida(crudo, req.headers['x-hub-signature-256'])) return responderTexto(res, 401, 'Firma no válida');

  let aviso;
  try { aviso = JSON.parse(crudo.toString('utf8')); } catch { return responderTexto(res, 400, ''); }

  for (const entry of aviso.entry || []) {
    for (const cambio of entry.changes || []) {
      const v = cambio.value || {};
      if (v.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_ID) continue;
      const nombres = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile?.name]));
      // v.statuses (enviado, entregado, leído) llegan también aquí: no los necesitamos
      for (const m of v.messages || []) {
        try { await atender(m, nombres[m.from]); } catch (e) { console.error('WhatsApp:', e); }
      }
    }
  }
  // Siempre 200: si respondemos con error, Meta repite el aviso durante días
  responderTexto(res, 200, 'ok');
}

function responderTexto(res, estado, texto) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(texto);
}

/** Meta manda hub.verify_token (tu palabra secreta) y espera que le devolvamos hub.challenge */
function verificar(req, res) {
  const p = parametros(req);
  const esperado = Buffer.from(process.env.WHATSAPP_VERIFY_TOKEN || '');
  const recibido = Buffer.from(p.get('hub.verify_token') || '');
  const ok = p.get('hub.mode') === 'subscribe' && esperado.length > 0 &&
    esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
  return ok ? responderTexto(res, 200, p.get('hub.challenge') || '') : responderTexto(res, 403, 'Token incorrecto');
}

/** Traduce el mensaje de Meta a algo sencillo para el bot */
function leerEntrada(m) {
  if (m.type === 'text') return { tipo: 'texto', texto: m.text?.body || '' };
  if (m.type === 'interactive') {
    const r = m.interactive?.button_reply || m.interactive?.list_reply || {};
    return { tipo: 'opcion', id: r.id || '', texto: r.title || '' };
  }
  if (m.type === 'button') return { tipo: 'texto', texto: m.button?.text || '' };
  return { tipo: 'otro' };
}

async function atender(m, nombrePerfil) {
  const telefono = m.from;
  const entrada = leerEntrada(m);

  // 1. Guardar el mensaje. Si ya existía, Meta lo está repitiendo: no se contesta dos veces.
  const nuevo = await query(
    `INSERT INTO wa_mensajes (telefono, autor, texto, wa_id) VALUES ($1, 'cliente', $2, $3)
     ON CONFLICT (wa_id) DO NOTHING RETURNING id`,
    [telefono, entrada.texto || `[${m.type}]`, m.id]
  );
  if (!nuevo.rowCount) return;

  // 2. Crear o actualizar la conversación. (xmax = 0) es true solo si la fila es nueva.
  const { rows: [chat] } = await query(
    `INSERT INTO wa_chats (telefono, nombre, idioma, sin_leer, ultimo_entrante)
     VALUES ($1, $2, $3, 1, now())
     ON CONFLICT (telefono) DO UPDATE SET
       nombre = COALESCE(EXCLUDED.nombre, wa_chats.nombre),
       sin_leer = wa_chats.sin_leer + 1,
       ultimo_entrante = now()
     RETURNING *, (xmax = 0) AS es_nuevo`,
    [telefono, nombrePerfil || null, pareceGallego(entrada.texto) ? 'gl' : 'es']
  );

  // 3. Si Nadia está atendiendo, el bot calla (salvo que el cliente pida el menú)
  const enPausa = chat.modo === 'humano' && chat.humano_hasta && new Date(chat.humano_hasta) > new Date();
  const pideMenu = entrada.id === 'tema:menu' || (entrada.tipo === 'texto' && temaDe(entrada.texto) === 'menu');
  if (enPausa && !pideMenu) return;

  // 4. Una reserva a medias de hace horas se olvida
  if (chat.paso && Date.now() - new Date(chat.actualizado).getTime() > MINUTOS_PASO * 60e3) {
    chat.paso = null;
    chat.datos = {};
  }

  // 5. El bot decide qué contestar
  const r = await responder(chat, entrada);
  const esSaludo = entrada.tipo === 'texto' && temaDe(entrada.texto) === 'hola';
  if (chat.es_nuevo && !esSaludo) r.mensajes.unshift(saludo(r.idioma, chat.nombre));

  // 6. Enviar las respuestas en orden y guardar en qué punto se ha quedado
  for (const mensaje of r.mensajes) await enviarWhatsApp(telefono, mensaje);
  await query(
    `UPDATE wa_chats SET paso = $2, datos = $3, idioma = $4,
       modo = $5, humano_hasta = CASE WHEN $5 = 'humano' THEN now() + make_interval(hours => $6) END,
       actualizado = now()
     WHERE telefono = $1`,
    [telefono, r.paso, JSON.stringify(r.datos || {}), r.idioma, r.humano ? 'humano' : 'bot', HORAS_HUMANO]
  );
}
