/* =============================================================
   Acceso al panel (/admin)
   - La contraseña está en la variable de entorno ADMIN_PASSWORD
     (en Vercel, nunca en el código ni en GitHub).
   - Al entrar se guarda una cookie con un "token" firmado:
       datos (caducidad) + firma HMAC hecha con la contraseña.
     Si alguien cambia los datos, la firma deja de coincidir.
     Si cambias la contraseña, todas las sesiones se cierran.
   Solo usa el módulo crypto que trae Node: sin librerías.
   ============================================================= */
import crypto from 'node:crypto';
import { leerCookie } from './http.js';

const COOKIE = 'lagoa_admin';
const DURACION = 7 * 24 * 3600; // la sesión dura 7 días
const MIN_LONGITUD = 10;

const sha256 = texto => crypto.createHash('sha256').update(String(texto)).digest();

/** null si no hay contraseña configurada (o es demasiado corta) */
function claveFirma() {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || p.length < MIN_LONGITUD) return null;
  return sha256('lagoa-sesion:' + p);
}

export const passwordConfigurada = () => claveFirma() !== null;

/** Compara en tiempo constante (no da pistas por lo que tarda en responder) */
export function passwordCorrecta(intento) {
  if (!passwordConfigurada()) return false;
  return crypto.timingSafeEqual(sha256(intento), sha256(process.env.ADMIN_PASSWORD));
}

const firmar = datos => crypto.createHmac('sha256', claveFirma()).update(datos).digest('base64url');

export function crearToken() {
  const datos = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + DURACION })).toString('base64url');
  return `${datos}.${firmar(datos)}`;
}

export function tokenValido(token) {
  if (!token || !passwordConfigurada()) return false;
  const [datos, firma] = token.split('.');
  if (!datos || !firma) return false;
  const a = Buffer.from(firma), b = Buffer.from(firmar(datos));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(datos, 'base64url').toString()).exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

// HttpOnly: el JavaScript de la página no puede leerla.
// SameSite=Strict: otra web no puede usar tu sesión.
export const cookieSesion = token => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION}`;
export const cookieBorrada = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const sesionActiva = req => tokenValido(leerCookie(req, COOKIE));
