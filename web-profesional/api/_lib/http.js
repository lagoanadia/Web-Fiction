/* =============================================================
   Utilidades HTTP comunes a todas las funciones de la API
   (solo Node, para que funcionen igual en Vercel y en local)
   ============================================================= */

/** Responde en JSON y evita que el navegador guarde la respuesta en caché */
export function enviar(res, estado, datos) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}

/** Corta la petición si el método no está permitido */
export function permitir(req, res, metodos) {
  if (metodos.includes(req.method)) return true;
  res.setHeader('Allow', metodos.join(', '));
  enviar(res, 405, { error: 'Método no permitido' });
  return false;
}

/** Parámetros de la URL (?desde=…&hasta=…) */
export const parametros = req => new URL(req.url, 'http://localhost').searchParams;

/** Cuerpo JSON de la petición (Vercel ya lo convierte; por si llega como texto) */
export function cuerpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

/** Las peticiones que cambian datos deben ser JSON (protege contra formularios de otras webs) */
export const esJson = req => (req.headers['content-type'] || '').includes('application/json');

export function leerCookie(req, nombre) {
  const cookies = req.headers.cookie || '';
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Errores: mensaje claro si falta la base de datos, genérico en el resto */
export function fallo(res, e) {
  if (e && e.code === 'NO_DB') return enviar(res, 503, { error: 'La base de datos aún no está configurada.' });
  console.error(e);
  enviar(res, 500, { error: 'Error interno. Inténtalo de nuevo.' });
}

/** Limpia un texto del usuario: quita espacios y lo recorta */
export const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
