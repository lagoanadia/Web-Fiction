/* =============================================================
   GET /api/disponibilidad  (pública)
   Devuelve el horario y las horas ya ocupadas de los próximos días.
   Solo fecha y hora: nunca datos de otros clientes.
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, fallo } from './_lib/http.js';
import { HORARIO, DIAS_VISTA, ANTELACION_HORAS, hoyMadrid, sumarDias } from './_lib/horario.js';

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET'])) return;
  const hoy = hoyMadrid();
  const hasta = sumarDias(hoy, DIAS_VISTA);
  try {
    const { rows } = await query(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora
         FROM citas WHERE estado <> 'cancelada' AND fecha BETWEEN $1 AND $2
       UNION
       SELECT to_char(fecha, 'YYYY-MM-DD'), to_char(hora, 'HH24:MI')
         FROM bloqueos WHERE fecha BETWEEN $1 AND $2`,
      [hoy, hasta]
    );
    enviar(res, 200, {
      horario: HORARIO,
      diasVista: DIAS_VISTA,
      antelacionHoras: ANTELACION_HORAS,
      ocupados: rows.map(r => `${r.fecha} ${r.hora}`)
    });
  } catch (e) {
    fallo(res, e);
  }
}
