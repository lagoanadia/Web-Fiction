/* =============================================================
   Guardar citas de clientes (lo usan la web y el bot de WhatsApp)
   Así las dos entradas siguen exactamente las mismas reglas.
   ============================================================= */
import { query } from './db.js';
import { hoyMadrid } from './horario.js';

export const MODALIDADES = ['Videollamada', 'Llamada de teléfono', 'En persona (solo A Coruña ciudad)'];
export const MAX_CITAS_POR_TELEFONO = 2; // citas futuras activas a la vez (frena reservas en masa)

/** Mismo número aunque se escriba distinto (+34 600…, 600-…): se comparan los 9 últimos dígitos */
export const ultimos9 = telefono => String(telefono).replace(/\D/g, '').slice(-9);

const COINCIDE_TELEFONO = `right(regexp_replace(telefono, '[^0-9]', '', 'g'), 9) = $1`;

/** Citas activas de hoy en adelante de un teléfono */
export async function citasActivasDe(telefono) {
  const { rows } = await query(
    `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora, modalidad, estado
       FROM citas WHERE ${COINCIDE_TELEFONO} AND estado <> 'cancelada' AND fecha >= $2
      ORDER BY fecha, hora`,
    [ultimos9(telefono), hoyMadrid()]
  );
  return rows;
}

/** El cliente anula su propia cita (solo si el teléfono coincide) */
export async function anularCitaDe(id, telefono) {
  const { rowCount } = await query(
    `UPDATE citas SET estado = 'cancelada' WHERE id = $2 AND ${COINCIDE_TELEFONO} AND estado <> 'cancelada'`,
    [ultimos9(telefono), id]
  );
  return rowCount > 0;
}

/** Guarda una cita YA VALIDADA (fecha, hora, modalidad…).
    Devuelve { estado: 201, id } o { estado: 409 | 429, motivo } */
export async function guardarCita(d, origen = 'web') {
  const bloqueado = await query('SELECT 1 FROM bloqueos WHERE fecha = $1 AND hora = $2', [d.fecha, d.hora]);
  if (bloqueado.rowCount) return { estado: 409, motivo: 'ocupada' };

  if ((await citasActivasDe(d.telefono)).length >= MAX_CITAS_POR_TELEFONO) return { estado: 429, motivo: 'limite' };

  try {
    const { rows: [cita] } = await query(
      `INSERT INTO citas (fecha, hora, modalidad, nombre, negocio, telefono, email, nota, origen)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), $9)
       RETURNING id`,
      [d.fecha, d.hora, d.modalidad, d.nombre, d.negocio || '', d.telefono, d.email || '', d.nota || '', origen]
    );
    return { estado: 201, id: cita.id };
  } catch (e) {
    // 23505 = la regla "una cita por hora" de la base de datos ha saltado
    if (e.code === '23505') return { estado: 409, motivo: 'recien_ocupada' };
    throw e;
  }
}
