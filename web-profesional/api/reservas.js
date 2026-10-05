/* =============================================================
   POST /api/reservas  (pública)
   Guarda la solicitud de consulta de un cliente. Antes valida todo
   en el servidor: lo que llega del navegador nunca es de fiar.
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, cuerpo, esJson, fallo, texto } from './_lib/http.js';
import { huecoReservable, hoyMadrid } from './_lib/horario.js';

export const MODALIDADES = ['Videollamada', 'Llamada de teléfono', 'En persona (solo A Coruña ciudad)'];
const MAX_CITAS_POR_TELEFONO = 2; // citas futuras activas a la vez (frena reservas en masa)

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  const b = cuerpo(req);
  if (!b) return enviar(res, 400, { error: 'Datos no válidos.' });

  // Campo trampa invisible: si un robot lo rellena, fingimos que ha ido bien
  if (b._honey) return enviar(res, 201, { ok: true });

  const d = {
    fecha: texto(b.fecha, 10),
    hora: texto(b.hora, 5),
    modalidad: texto(b.modalidad, 60),
    nombre: texto(b.nombre, 100),
    negocio: texto(b.negocio, 120),
    telefono: texto(b.telefono, 30),
    email: texto(b.email, 160),
    nota: texto(b.nota, 1000)
  };

  const errores = [];
  if (!huecoReservable(d.fecha, d.hora)) errores.push('La fecha u hora elegida no está disponible.');
  if (!MODALIDADES.includes(d.modalidad)) errores.push('La modalidad no es válida.');
  if (!d.nombre) errores.push('Falta el nombre.');
  if (!/^\+?[\d\s().-]{6,}$/.test(d.telefono)) errores.push('El teléfono no es válido.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errores.push('El email no es válido.');
  if (b.privacidad !== true) errores.push('Debes aceptar la política de privacidad.');
  if (errores.length) return enviar(res, 400, { error: errores.join(' ') });

  try {
    const bloqueado = await query('SELECT 1 FROM bloqueos WHERE fecha = $1 AND hora = $2', [d.fecha, d.hora]);
    if (bloqueado.rowCount) return enviar(res, 409, { error: 'Esa hora ya no está disponible. Elige otra, por favor.' });

    // Mismo número aunque se escriba distinto (+34 600…, 600-…): se comparan los 9 últimos dígitos
    const numero = d.telefono.replace(/\D/g, '').slice(-9);
    const { rows: [{ n }] } = await query(
      `SELECT count(*)::int AS n FROM citas
        WHERE right(regexp_replace(telefono, '[^0-9]', '', 'g'), 9) = $1
          AND estado <> 'cancelada' AND fecha >= $2`,
      [numero, hoyMadrid()]
    );
    if (n >= MAX_CITAS_POR_TELEFONO) {
      return enviar(res, 429, { error: 'Ya tienes citas pendientes con este teléfono. Si necesitas otra, escríbeme por WhatsApp.' });
    }

    const { rows: [cita] } = await query(
      `INSERT INTO citas (fecha, hora, modalidad, nombre, negocio, telefono, email, nota)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''))
       RETURNING id`,
      [d.fecha, d.hora, d.modalidad, d.nombre, d.negocio, d.telefono, d.email, d.nota]
    );
    enviar(res, 201, { ok: true, id: cita.id });
  } catch (e) {
    // 23505 = la regla "una cita por hora" de la base de datos ha saltado
    if (e.code === '23505') return enviar(res, 409, { error: 'Esa hora se acaba de ocupar. Elige otra, por favor.' });
    fallo(res, e);
  }
}
