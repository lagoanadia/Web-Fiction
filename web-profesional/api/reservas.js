/* =============================================================
   POST /api/reservas  (pública)
   Guarda la solicitud de consulta de un cliente. Antes valida todo
   en el servidor: lo que llega del navegador nunca es de fiar.
   ============================================================= */
import { enviar, permitir, cuerpo, esJson, fallo, texto } from './_lib/http.js';
import { huecoReservable } from './_lib/horario.js';
import { MODALIDADES, guardarCita } from './_lib/citas.js';

const MENSAJES = {
  ocupada: 'Esa hora ya no está disponible. Elige otra, por favor.',
  recien_ocupada: 'Esa hora se acaba de ocupar. Elige otra, por favor.',
  limite: 'Ya tienes citas pendientes con este teléfono. Si necesitas otra, escríbeme por WhatsApp.'
};

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
    // Las reglas (hora bloqueada, máximo de citas por teléfono, una cita por hora) están en _lib/citas.js
    const r = await guardarCita(d, 'web');
    if (r.estado === 201) return enviar(res, 201, { ok: true, id: r.id });
    enviar(res, r.estado, { error: MENSAJES[r.motivo] });
  } catch (e) {
    fallo(res, e);
  }
}
