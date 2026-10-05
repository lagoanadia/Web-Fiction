/* =============================================================
   /api/admin/bloqueos  (solo con sesión)
   POST   { fecha, hora }     → cierra un hueco (deja de ofrecerse en la web)
   DELETE ?fecha=…&hora=…     → lo vuelve a abrir
   ============================================================= */
import { query } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { esFecha, esHora } from '../_lib/horario.js';

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST', 'DELETE'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });

  try {
    if (req.method === 'POST') {
      if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
      const { fecha, hora } = cuerpo(req) || {};
      if (!esFecha(fecha) || !esHora(hora)) return enviar(res, 400, { error: 'Fecha u hora no válida.' });
      const ocupada = await query(`SELECT 1 FROM citas WHERE fecha = $1 AND hora = $2 AND estado <> 'cancelada'`, [fecha, hora]);
      if (ocupada.rowCount) return enviar(res, 409, { error: 'Ese hueco ya tiene una cita.' });
      await query('INSERT INTO bloqueos (fecha, hora) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fecha, hora]);
      return enviar(res, 201, { ok: true });
    }
    const p = parametros(req);
    const fecha = p.get('fecha'), hora = p.get('hora');
    if (!esFecha(fecha) || !esHora(hora)) return enviar(res, 400, { error: 'Fecha u hora no válida.' });
    await query('DELETE FROM bloqueos WHERE fecha = $1 AND hora = $2', [fecha, hora]);
    enviar(res, 200, { ok: true });
  } catch (e) {
    fallo(res, e);
  }
}
