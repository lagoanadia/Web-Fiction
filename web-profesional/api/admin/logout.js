/* POST /api/admin/logout — borra la cookie de sesión */
import { enviar, permitir } from '../_lib/http.js';
import { cookieBorrada } from '../_lib/auth.js';

export default function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  res.setHeader('Set-Cookie', cookieBorrada());
  enviar(res, 200, { ok: true });
}
