/* =============================================================
   Conexión a la base de datos (Postgres)
   - En Vercel, DATABASE_URL la crea la integración de Neon.
   - En local se puede apuntar a un Postgres propio.
   La primera consulta de cada instancia crea las tablas si no existen.
   ============================================================= */
import pg from 'pg';

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS citas (
    id         SERIAL PRIMARY KEY,
    fecha      DATE        NOT NULL,
    hora       TIME        NOT NULL,
    modalidad  TEXT        NOT NULL,
    nombre     TEXT        NOT NULL,
    negocio    TEXT,
    telefono   TEXT        NOT NULL,
    email      TEXT,
    nota       TEXT,
    estado     TEXT        NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),
    origen     TEXT        NOT NULL DEFAULT 'web',
    creada     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Una hora solo puede tener UNA cita activa. Lo garantiza la base de datos,
  -- así que es imposible reservar dos veces el mismo hueco aunque dos clientes
  -- pulsen "Solicitar" en el mismo segundo.
  CREATE UNIQUE INDEX IF NOT EXISTS citas_hueco_unico
    ON citas (fecha, hora) WHERE estado <> 'cancelada';

  -- Huecos que Nadia cierra a mano desde el panel (no se ofrecen en la web)
  CREATE TABLE IF NOT EXISTS bloqueos (
    fecha DATE NOT NULL,
    hora  TIME NOT NULL,
    PRIMARY KEY (fecha, hora)
  );
`;

let pool = null;
let esquemaListo = null;

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const e = new Error('Falta la variable DATABASE_URL');
    e.code = 'NO_DB';
    throw e;
  }
  if (!pool) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    pool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: true },
      max: 1 // las funciones de Vercel son pequeñas: una conexión por instancia basta
    });
  }
  return pool;
}

function asegurarEsquema() {
  if (!esquemaListo) {
    esquemaListo = getPool().query(ESQUEMA).catch(e => { esquemaListo = null; throw e; });
  }
  return esquemaListo;
}

/** Ejecuta una consulta con parámetros ($1, $2…). Nunca se concatenan datos en el SQL. */
export async function query(texto, parametros = []) {
  await asegurarEsquema();
  return getPool().query(texto, parametros);
}
