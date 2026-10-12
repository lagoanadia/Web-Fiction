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

  -- WhatsApp: una fila por cliente que escribe al número del negocio.
  -- "paso" y "datos" guardan por dónde va la conversación con el bot
  -- (por ejemplo, a mitad de una reserva).
  CREATE TABLE IF NOT EXISTS wa_chats (
    telefono        TEXT PRIMARY KEY,   -- formato internacional sin "+": 34600111222
    nombre          TEXT,               -- nombre del perfil de WhatsApp
    idioma          TEXT NOT NULL DEFAULT 'es',
    paso            TEXT,
    datos           JSONB NOT NULL DEFAULT '{}',
    modo            TEXT NOT NULL DEFAULT 'bot' CHECK (modo IN ('bot', 'humano')),
    humano_hasta    TIMESTAMPTZ,        -- mientras sea futuro, el bot no contesta
    sin_leer        INT NOT NULL DEFAULT 0,
    ultimo_entrante TIMESTAMPTZ,        -- para la ventana de 24 h de WhatsApp
    actualizado     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Historial de mensajes (entrantes y salientes). wa_id es el id que da
  -- WhatsApp: al ser UNIQUE, si Meta reenvía un mensaje no se procesa dos veces.
  CREATE TABLE IF NOT EXISTS wa_mensajes (
    id        SERIAL PRIMARY KEY,
    telefono  TEXT NOT NULL,
    autor     TEXT NOT NULL CHECK (autor IN ('cliente', 'bot', 'nadia')),
    texto     TEXT NOT NULL,
    wa_id     TEXT UNIQUE,
    creado    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS wa_mensajes_chat ON wa_mensajes (telefono, creado);

  -- CRM: una ficha por cliente (o persona interesada). Se crea sola cuando
  -- alguien reserva una consulta o hace un pedido, y se puede editar en el panel.
  CREATE TABLE IF NOT EXISTS clientes (
    id         SERIAL PRIMARY KEY,
    nombre     TEXT NOT NULL,
    email      TEXT,
    telefono   TEXT,
    tel9       TEXT GENERATED ALWAYS AS (right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 9)) STORED,
    negocio    TEXT,
    nif        TEXT,
    direccion  TEXT,
    notas      TEXT,
    origen     TEXT NOT NULL DEFAULT 'web',
    creado     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS clientes_email ON clientes (lower(email)) WHERE email IS NOT NULL;
  CREATE INDEX IF NOT EXISTS clientes_tel9 ON clientes (tel9);

  -- Pedidos de servicios. Los importes van en CÉNTIMOS (enteros: sin errores de redondeo)
  -- y los calcula siempre el servidor. "facturacion" guarda los datos fiscales tal
  -- como los escribió el cliente en ese pedido.
  CREATE TABLE IF NOT EXISTS pedidos (
    id           SERIAL PRIMARY KEY,
    cliente_id   INT NOT NULL REFERENCES clientes(id),
    lineas       JSONB NOT NULL,
    base         INT NOT NULL,
    iva          INT NOT NULL,
    total        INT NOT NULL,
    mensual      INT NOT NULL DEFAULT 0,
    facturacion  JSONB NOT NULL DEFAULT '{}',
    nota         TEXT,
    estado       TEXT NOT NULL DEFAULT 'pendiente_pago'
                 CHECK (estado IN ('pendiente_pago', 'pagado', 'en_curso', 'entregado', 'cancelado')),
    origen       TEXT NOT NULL DEFAULT 'web',
    token        TEXT NOT NULL,           -- enlace privado para que el cliente vea sus documentos
    creado       TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS pedidos_cliente ON pedidos (cliente_id);

  -- Facturas: numeración correlativa por año y serie (F = ordinaria, R = rectificativa).
  -- Se guarda una copia de emisor, cliente y líneas: una factura emitida no cambia nunca.
  CREATE TABLE IF NOT EXISTS facturas (
    id         SERIAL PRIMARY KEY,
    serie      TEXT NOT NULL,
    numero     INT  NOT NULL,
    tipo       TEXT NOT NULL DEFAULT 'ordinaria' CHECK (tipo IN ('ordinaria', 'rectificativa')),
    rectifica  INT REFERENCES facturas(id),
    pedido_id  INT NOT NULL REFERENCES pedidos(id),
    fecha      DATE NOT NULL,
    emisor     JSONB NOT NULL,
    cliente    JSONB NOT NULL,
    lineas     JSONB NOT NULL,
    base       INT NOT NULL,
    iva        INT NOT NULL,
    total      INT NOT NULL,
    creada     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (serie, numero)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS facturas_una_por_tipo ON facturas (pedido_id, tipo);
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

/** Ejecuta varias consultas como una sola operación: o se guardan todas o ninguna.
    fn recibe una función q(texto, parametros) igual que query(). */
export async function transaccion(fn) {
  await asegurarEsquema();
  const cliente = await getPool().connect();
  try {
    await cliente.query('BEGIN');
    const r = await fn((t, p = []) => cliente.query(t, p));
    await cliente.query('COMMIT');
    return r;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}
