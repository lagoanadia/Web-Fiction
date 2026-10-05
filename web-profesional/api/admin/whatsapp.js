/* =============================================================
   /api/admin/whatsapp  (solo con sesión)
   GET                       → lista de conversaciones
   GET   ?telefono=34600…    → mensajes de una conversación (y la marca como leída)
   POST  { telefono, texto } → Nadia contesta (el bot se pausa 24 h en ese chat)
   PATCH { telefono, modo }  → 'bot' (el bot vuelve a contestar) o 'humano' (pausarlo)
   ============================================================= */
import { query } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo, texto } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { whatsappConfigurado, enviarWhatsApp } from '../_lib/whatsapp.js';

const DIAS_HISTORIAL = 180; // los mensajes más antiguos se borran (privacidad: no guardar de más)
const RE_TELEFONO = /^\d{8,15}$/;
const EN_PAUSA = `(modo = 'humano' AND humano_hasta > now())`;
const VENTANA_ABIERTA = `(ultimo_entrante > now() - interval '24 hours')`;

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET', 'POST', 'PATCH'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  if (req.method !== 'GET' && !esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });

  try {
    if (req.method === 'GET') {
      const telefono = parametros(req).get('telefono');
      return telefono ? await conversacion(res, telefono) : await lista(res);
    }
    if (req.method === 'POST') return await contestar(req, res);
    return await cambiarModo(req, res);
  } catch (e) {
    fallo(res, e);
  }
}

async function lista(res) {
  await query(`DELETE FROM wa_mensajes WHERE creado < now() - make_interval(days => $1)`, [DIAS_HISTORIAL]);
  const { rows } = await query(
    `SELECT c.telefono, c.nombre, c.sin_leer, ${EN_PAUSA} AS en_pausa, u.texto AS ultimo, u.autor AS ultimo_autor, u.creado AS ultimo_en
       FROM wa_chats c
       LEFT JOIN LATERAL (SELECT texto, autor, creado FROM wa_mensajes m
                           WHERE m.telefono = c.telefono ORDER BY creado DESC, id DESC LIMIT 1) u ON true
      ORDER BY u.creado DESC NULLS LAST
      LIMIT 100`);
  enviar(res, 200, {
    configurado: whatsappConfigurado(),
    chats: rows,
    esperando: rows.filter(c => c.en_pausa && c.sin_leer > 0).length
  });
}

async function conversacion(res, telefono) {
  if (!RE_TELEFONO.test(telefono)) return enviar(res, 400, { error: 'Teléfono no válido.' });
  const { rows: [chat] } = await query(
    `UPDATE wa_chats SET sin_leer = 0 WHERE telefono = $1
     RETURNING telefono, nombre, ${EN_PAUSA} AS en_pausa, humano_hasta, ${VENTANA_ABIERTA} AS ventana_abierta`, [telefono]);
  if (!chat) return enviar(res, 404, { error: 'No existe esa conversación.' });
  const { rows } = await query(
    `SELECT * FROM (SELECT id, autor, texto, creado FROM wa_mensajes WHERE telefono = $1 ORDER BY creado DESC, id DESC LIMIT 200) t
      ORDER BY creado, id`, [telefono]);
  enviar(res, 200, { chat, mensajes: rows });
}

async function contestar(req, res) {
  const b = cuerpo(req) || {};
  const telefono = texto(b.telefono, 20);
  const mensaje = texto(b.texto, 4000);
  if (!RE_TELEFONO.test(telefono) || !mensaje) return enviar(res, 400, { error: 'Escribe un mensaje.' });
  if (!whatsappConfigurado()) return enviar(res, 503, { error: 'WhatsApp aún no está configurado en Vercel.' });

  const { rows: [chat] } = await query(`SELECT ${VENTANA_ABIERTA} AS ventana_abierta FROM wa_chats WHERE telefono = $1`, [telefono]);
  if (!chat) return enviar(res, 404, { error: 'No existe esa conversación.' });
  // Regla de WhatsApp: pasadas 24 h desde el último mensaje del cliente, la empresa
  // solo puede escribirle con una plantilla aprobada por Meta.
  if (!chat.ventana_abierta) {
    return enviar(res, 409, { error: 'Han pasado más de 24 h desde su último mensaje: WhatsApp no deja escribirle desde aquí. Llámale o espera a que vuelva a escribir.' });
  }

  try {
    await enviarWhatsApp(telefono, { texto: mensaje }, 'nadia');
  } catch (e) {
    if (e.code !== 'WA_API') throw e;
    return enviar(res, 502, { error: `WhatsApp no ha aceptado el mensaje: ${e.message}` });
  }
  // Mientras Nadia habla, el bot no interrumpe
  await query(`UPDATE wa_chats SET modo = 'humano', humano_hasta = now() + interval '24 hours', paso = NULL, datos = '{}' WHERE telefono = $1`, [telefono]);
  enviar(res, 201, { ok: true });
}

async function cambiarModo(req, res) {
  const { telefono, modo } = cuerpo(req) || {};
  if (!RE_TELEFONO.test(String(telefono)) || !['bot', 'humano'].includes(modo)) return enviar(res, 400, { error: 'Datos no válidos.' });
  const { rowCount } = await query(
    modo === 'bot'
      ? `UPDATE wa_chats SET modo = 'bot', humano_hasta = NULL, paso = NULL, datos = '{}' WHERE telefono = $1`
      : `UPDATE wa_chats SET modo = 'humano', humano_hasta = now() + interval '24 hours' WHERE telefono = $1`,
    [telefono]);
  if (!rowCount) return enviar(res, 404, { error: 'No existe esa conversación.' });
  enviar(res, 200, { ok: true });
}
