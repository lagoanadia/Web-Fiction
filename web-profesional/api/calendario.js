/* =============================================================
   GET /api/calendario?t=<CALENDARIO_TOKEN>
   Todas las citas en formato iCalendar (.ics). Te suscribes UNA vez
   y aparecen solas en Google Calendar, Apple Calendar u Outlook:
     Google Calendar → Otros calendarios → "+" → Desde URL →
     https://TU-WEB/api/calendario?t=TU_TOKEN
   (Google actualiza los calendarios suscritos cada pocas horas.)
   CALENDARIO_TOKEN va en Vercel (mínimo 16 caracteres): quien tenga
   el enlace ve nombres y teléfonos, así que no lo compartas.
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, parametros, fallo } from './_lib/http.js';
import { madridAUtc, hoyMadrid, sumarDias } from './_lib/horario.js';
import { tokenIgual } from './_lib/facturacion.js';

const DURACION_MIN = 30;

const fechaIcs = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** Escapa texto para iCalendar y corta líneas largas (máx. 75 caracteres) */
const esc = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const plegar = linea => linea.length <= 74 ? linea : linea.match(/.{1,73}/g).join('\r\n ');

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET'])) return;
  const token = process.env.CALENDARIO_TOKEN || '';
  if (token.length < 16) return enviar(res, 503, { error: 'Falta configurar CALENDARIO_TOKEN (mínimo 16 caracteres) en Vercel.' });
  if (!tokenIgual(parametros(req).get('t'), token)) return enviar(res, 404, { error: 'No encontrado.' });
  try {
    const hoy = hoyMadrid();
    const { rows } = await query(
      `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora, modalidad, nombre, negocio,
              telefono, email, nota, estado, origen, creada
         FROM citas WHERE estado <> 'cancelada' AND fecha BETWEEN $1 AND $2 ORDER BY fecha, hora`,
      [sumarDias(hoy, -60), sumarDias(hoy, 180)]);
    const ahora = fechaIcs(Date.now());
    const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lagoa//Citas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:Lagoa · Citas', 'X-WR-TIMEZONE:Europe/Madrid', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
    for (const c of rows) {
      const ini = madridAUtc(c.fecha, c.hora);
      const detalle = [c.negocio && `Negocio: ${c.negocio}`, c.telefono && `Teléfono: ${c.telefono}`, c.email && `Email: ${c.email}`,
        `Modalidad: ${c.modalidad}`, `Estado: ${c.estado}`, c.origen !== 'web' && `Origen: ${c.origen}`, c.nota && `Nota: ${c.nota}`].filter(Boolean).join('\n');
      lineas.push('BEGIN:VEVENT', `UID:cita-${c.id}@lagoa`, `DTSTAMP:${ahora}`, `DTSTART:${fechaIcs(ini)}`, `DTEND:${fechaIcs(ini + DURACION_MIN * 60e3)}`,
        `SUMMARY:${esc(`${c.estado === 'pendiente' ? '⏳ ' : ''}Consulta · ${c.nombre}`)}`, `DESCRIPTION:${esc(detalle)}`,
        `STATUS:${c.estado === 'confirmada' ? 'CONFIRMED' : 'TENTATIVE'}`, 'END:VEVENT');
    }
    lineas.push('END:VCALENDAR');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="lagoa-citas.ics"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(lineas.map(plegar).join('\r\n') + '\r\n');
  } catch (e) {
    fallo(res, e);
  }
}
