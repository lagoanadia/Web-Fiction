/* GET /api/admin/sesion — ¿hay sesión abierta? (el panel lo usa al cargar) */
import { enviar, permitir } from '../_lib/http.js';
import { sesionActiva, passwordConfigurada } from '../_lib/auth.js';

export default function handler(req, res) {
  if (!permitir(req, res, ['GET'])) return;
  enviar(res, 200, { activa: sesionActiva(req), configurada: passwordConfigurada() });
}
