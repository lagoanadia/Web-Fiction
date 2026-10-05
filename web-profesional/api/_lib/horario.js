/* =============================================================
   HORARIO DE CONSULTAS — edita aquí tu disponibilidad
   Es la única fuente de verdad: la web la pide a la API, y el
   servidor la usa para rechazar horas que no existen.
   ============================================================= */
export const HORARIO = {
  // 0 = domingo, 1 = lunes … 6 = sábado
  1: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  2: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  3: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  4: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  5: ['16:00', '16:30', '17:00', '17:30', '18:00'],
  6: ['10:00', '10:30', '11:00', '11:30', '12:00']
};
export const DIAS_VISTA = 14;        // cuántos días por delante se pueden reservar
export const ANTELACION_HORAS = 12;  // antelación mínima
export const ZONA = 'Europe/Madrid'; // las horas son siempre hora de A Coruña

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const esFecha = f => typeof f === 'string' && RE_FECHA.test(f) && !Number.isNaN(Date.parse(f + 'T00:00:00Z'));
export const esHora = h => typeof h === 'string' && RE_HORA.test(h);

/* El servidor de Vercel funciona en hora UTC; estas funciones traducen
   entre UTC y la hora de Madrid (incluido el cambio de horario). */
function partesEnZona(ms) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  return Object.fromEntries(f.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
}

/** "2026-10-06" + "16:30" (hora de Madrid) → milisegundos UTC */
export function madridAUtc(fecha, hora) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const supuesto = Date.UTC(y, m - 1, d, h, mi);
  const p = partesEnZona(supuesto);
  const visto = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return supuesto - (visto - supuesto); // corrige la diferencia horaria
}

/** Fecha de hoy en Madrid, "AAAA-MM-DD" */
export function hoyMadrid(ahora = Date.now()) {
  const p = partesEnZona(ahora);
  return `${p.year}-${p.month}-${p.day}`;
}

export function sumarDias(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function diaSemana(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const horasDelDia = fecha => HORARIO[diaSemana(fecha)] || [];

/** ¿Se puede reservar este hueco desde la web? (existe, está en plazo y con antelación) */
export function huecoReservable(fecha, hora, ahora = Date.now()) {
  if (!esFecha(fecha) || !esHora(hora)) return false;
  const hoy = hoyMadrid(ahora);
  if (fecha < hoy || fecha > sumarDias(hoy, DIAS_VISTA)) return false;
  if (!horasDelDia(fecha).includes(hora)) return false;
  return madridAUtc(fecha, hora) > ahora + ANTELACION_HORAS * 3600e3;
}
