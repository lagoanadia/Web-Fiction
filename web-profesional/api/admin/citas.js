/* =============================================================
   /api/admin/citas  (solo con sesión)
   GET   ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD → citas, bloqueos y horario
   POST  { fecha, hora, nombre, telefono, … } → cita añadida a mano
   PATCH { id, estado }                      → confirmar / cancelar / reactivar
   ============================================================= */
import { query } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo, texto } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { HORARIO, esFecha, esHora, hoyMadrid, sumarDias } from '../_lib/horario.js';

const ESTADOS = ['pendiente', 'confirmada', 'cancelada'];
const CAMPOS = `id, to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora,
  modalidad, nombre, negocio, telefono, email, nota, estado, origen, creada`;

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET', 'POST', 'PATCH'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  if (req.method !== 'GET' && !esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });

  try {
    if (req.method === 'GET') return await listar(req, res);
    if (req.method === 'POST') return await crear(req, res);
    return await cambiarEstado(req, res);
  } catch (e) {
    if (e.code === '23505') return enviar(res, 409, { error: 'Ya hay otra cita activa a esa hora.' });
    fallo(res, e);
  }
}

async function listar(req, res) {
  const p = parametros(req);
  const hoy = hoyMadrid();
  let desde = p.get('desde'), hasta = p.get('hasta');
  if (!esFecha(desde)) desde = hoy;
  if (!esFecha(hasta) || hasta < desde) hasta = sumarDias(desde, 6);
  if (hasta > sumarDias(desde, 92)) hasta = sumarDias(desde, 92); // como mucho 3 meses de golpe

  const citas = await query(`SELECT ${CAMPOS} FROM citas WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha, hora, id`, [desde, hasta]);
  const bloqueos = await query(
    `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora
       FROM bloqueos WHERE fecha BETWEEN $1 AND $2`, [desde, hasta]);
  const pendientes = await query(
    `SELECT count(*)::int AS n FROM citas WHERE estado = 'pendiente' AND fecha >= $1`, [hoy]);

  enviar(res, 200, {
    desde, hasta, hoy,
    horario: HORARIO,
    citas: citas.rows,
    bloqueos: bloqueos.rows.map(r => `${r.fecha} ${r.hora}`),
    pendientesTotal: pendientes.rows[0].n
  });
}

async function crear(req, res) {
  const b = cuerpo(req) || {};
  const d = {
    fecha: texto(b.fecha, 10), hora: texto(b.hora, 5),
    nombre: texto(b.nombre, 100), negocio: texto(b.negocio, 120),
    telefono: texto(b.telefono, 30), email: texto(b.email, 160),
    modalidad: texto(b.modalidad, 60) || 'Videollamada', nota: texto(b.nota, 1000)
  };
  if (!esFecha(d.fecha) || !esHora(d.hora)) return enviar(res, 400, { error: 'Fecha u hora no válida.' });
  if (!d.nombre) return enviar(res, 400, { error: 'Falta el nombre.' });

  const { rows: [cita] } = await query(
    `INSERT INTO citas (fecha, hora, modalidad, nombre, negocio, telefono, email, nota, estado, origen)
     VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), 'confirmada', 'panel')
     RETURNING ${CAMPOS}`,
    [d.fecha, d.hora, d.modalidad, d.nombre, d.negocio, d.telefono, d.email, d.nota]
  );
  // Si ese hueco estaba bloqueado, deja de estarlo: ahora hay una cita
  await query('DELETE FROM bloqueos WHERE fecha = $1 AND hora = $2', [d.fecha, d.hora]);
  enviar(res, 201, { cita });
}

async function cambiarEstado(req, res) {
  const { id, estado } = cuerpo(req) || {};
  if (!Number.isInteger(id) || !ESTADOS.includes(estado)) return enviar(res, 400, { error: 'Datos no válidos.' });
  const { rows } = await query(`UPDATE citas SET estado = $2 WHERE id = $1 RETURNING ${CAMPOS}`, [id, estado]);
  if (!rows.length) return enviar(res, 404, { error: 'No existe esa cita.' });
  enviar(res, 200, { cita: rows[0] });
}
