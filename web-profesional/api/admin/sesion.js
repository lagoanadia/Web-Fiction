/* =============================================================
   /api/admin/sesion — todo lo de la sesión del panel en UNA función
   (el plan gratuito de Vercel admite 12 funciones como máximo).
   GET                     → ¿hay sesión abierta? (el panel lo usa al cargar)
   POST ?accion=login  { password } → si es correcta, guarda la cookie
   POST ?accion=logout              → borra la cookie
   Las direcciones antiguas /api/admin/login y /api/admin/logout siguen
   funcionando: vercel.json las redirige aquí.
   ============================================================= */
import { enviar, permitir, cuerpo, esJson, parametros } from '../_lib/http.js';
import { sesionActiva, passwordConfigurada, passwordCorrecta, crearToken, cookieSesion, cookieBorrada } from '../_lib/auth.js';

const espera = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') return enviar(res, 200, { activa: sesionActiva(req), configurada: passwordConfigurada() });

  const accion = parametros(req).get('accion');
  if (accion === 'logout') {
    res.setHeader('Set-Cookie', cookieBorrada());
    return enviar(res, 200, { ok: true });
  }
  if (accion !== 'login') return enviar(res, 400, { error: 'Acción no válida.' });
  if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  if (!passwordConfigurada()) {
    return enviar(res, 503, { error: 'Falta configurar ADMIN_PASSWORD (mínimo 10 caracteres) en Vercel.' });
  }
  const { password } = cuerpo(req) || {};
  if (!passwordCorrecta(password || '')) {
    await espera(800); // frena a quien intente adivinarla probando muchas
    return enviar(res, 401, { error: 'Contraseña incorrecta.' });
  }
  res.setHeader('Set-Cookie', cookieSesion(crearToken()));
  enviar(res, 200, { ok: true });
}
