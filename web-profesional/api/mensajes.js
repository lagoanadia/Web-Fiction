/* =============================================================
   POST /api/mensajes  (pública)
   Guarda un mensaje del formulario de contacto en el panel y
   crea o completa la ficha de esa persona en el CRM.
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, cuerpo, esJson, fallo, texto } from './_lib/http.js';
import { buscarOCrearCliente } from './_lib/clientes.js';
import { notificar } from './_lib/integraciones.js';

const MAX_POR_HORA = 5; // por email: frena el spam

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  const b = cuerpo(req);
  if (!b) return enviar(res, 400, { error: 'Datos no válidos.' });
  if (b._honey) return enviar(res, 201, { ok: true }); // robot: fingimos que ha ido bien

  const d = {
    nombre: texto(b.nombre, 120), email: texto(b.email, 160).toLowerCase(), telefono: texto(b.telefono, 30),
    negocio: texto(b.negocio, 120), servicio: texto(b.servicio, 80), texto: texto(b.mensaje, 4000)
  };
  const errores = [];
  if (!d.nombre) errores.push('Falta el nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errores.push('El email no es válido.');
  if (d.telefono && !/^\+?[\d\s().-]{6,}$/.test(d.telefono)) errores.push('El teléfono no es válido.');
  if (!d.texto) errores.push('Escribe tu mensaje.');
  if (b.privacidad !== true) errores.push('Debes aceptar la política de privacidad.');
  if (errores.length) return enviar(res, 400, { error: errores.join(' ') });

  try {
    const { rows: [{ n }] } = await query(
      `SELECT count(*)::int AS n FROM mensajes WHERE email = $1 AND creado > now() - interval '1 hour'`, [d.email]);
    if (n >= MAX_POR_HORA) return enviar(res, 429, { error: 'Has enviado varios mensajes seguidos. Te respondemos enseguida.' });
    const clienteId = await buscarOCrearCliente(d, 'mensaje');
    await query(
      `INSERT INTO mensajes (cliente_id, nombre, email, telefono, negocio, servicio, texto)
       VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7)`,
      [clienteId, d.nombre, d.email, d.telefono, d.negocio, d.servicio, d.texto]);
    await notificar('mensaje.nuevo', { nombre: d.nombre, email: d.email, telefono: d.telefono, negocio: d.negocio, estado: 'sin leer', canal: 'formulario', detalle: `${d.servicio ? `[${d.servicio}] ` : ''}${d.texto}` });
    enviar(res, 201, { ok: true });
  } catch (e) {
    fallo(res, e);
  }
}
