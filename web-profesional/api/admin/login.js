/* =============================================================
   POST /api/admin/login  { password }
   Si la contraseña es correcta, guarda la cookie de sesión.
   ============================================================= */
import { enviar, permitir, cuerpo, esJson } from '../_lib/http.js';
import { passwordConfigurada, passwordCorrecta, crearToken, cookieSesion } from '../_lib/auth.js';

const espera = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
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
