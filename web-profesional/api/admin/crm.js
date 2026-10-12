/* =============================================================
   /api/admin/crm  (solo con sesión)
   GET                       → resumen, pedidos recientes y clientes
   GET   ?cliente=<id>       → ficha: datos, pedidos, facturas y citas
   POST  { cliente: {...} }  → cliente nuevo a mano
   POST  { cliente_id, servicios, mantenimiento, nota } → pedido a mano
   PATCH { cliente: id, ...campos }  → editar ficha / notas
   PATCH { pedido: id, estado }      → cambiar estado del pedido.
         "pagado"   → emite la factura (numeración correlativa)
         "cancelado" con factura emitida → emite la rectificativa
   ============================================================= */
import { query, transaccion } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo, texto } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { calcularPedido, emitirFactura, emisorCompleto, nuevoToken, numeroFactura, ESTADOS_PEDIDO } from '../_lib/facturacion.js';

const CAMPOS_CLIENTE = ['nombre', 'email', 'telefono', 'negocio', 'nif', 'direccion', 'notas'];
const LIMITES = { nombre: 120, email: 160, telefono: 30, negocio: 120, nif: 20, direccion: 240, notas: 4000 };

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET', 'POST', 'PATCH'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  if (req.method !== 'GET' && !esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  try {
    if (req.method === 'GET') {
      const id = Number(parametros(req).get('cliente'));
      return Number.isInteger(id) && id > 0 ? await ficha(res, id) : await resumen(res);
    }
    const b = cuerpo(req) || {};
    if (req.method === 'POST') return b.cliente_id ? await pedidoManual(res, b) : await clienteNuevo(res, b.cliente || {});
    if (b.pedido) return await estadoPedido(res, b);
    if (b.cliente) return await editarCliente(res, b);
    enviar(res, 400, { error: 'Datos no válidos.' });
  } catch (e) {
    if (e.code === '23505') return enviar(res, 409, { error: 'Ya hay otro cliente con ese email.' });
    fallo(res, e);
  }
}

async function resumen(res) {
  const anio = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(new Date());
  const [kpi, pedidos, clientes] = await Promise.all([
    query(`SELECT
        (SELECT count(*)::int FROM clientes) AS clientes,
        (SELECT count(*)::int FROM pedidos WHERE estado = 'pendiente_pago') AS pendientes,
        (SELECT coalesce(sum(total), 0)::int FROM pedidos WHERE estado = 'pendiente_pago') AS por_cobrar,
        (SELECT coalesce(sum(total), 0)::int FROM facturas WHERE serie LIKE '%' || $1) AS facturado,
        (SELECT coalesce(sum(mensual), 0)::int FROM pedidos WHERE estado IN ('pagado', 'en_curso', 'entregado')) AS mensual`, [anio]),
    query(`SELECT p.id, p.total, p.mensual, p.estado, p.origen, p.token, p.lineas, p.creado, c.id AS cliente_id, c.nombre, c.negocio,
              (SELECT json_agg(json_build_object('serie', f.serie, 'numero', f.numero, 'tipo', f.tipo) ORDER BY f.id) FROM facturas f WHERE f.pedido_id = p.id) AS facturas
             FROM pedidos p JOIN clientes c ON c.id = p.cliente_id ORDER BY p.id DESC LIMIT 100`),
    query(`SELECT c.id, c.nombre, c.negocio, c.email, c.telefono, c.creado,
              count(p.id)::int AS pedidos,
              coalesce(sum(p.total) FILTER (WHERE p.estado IN ('pagado', 'en_curso', 'entregado')), 0)::int AS pagado,
              (SELECT count(*)::int FROM citas ct WHERE (c.email IS NOT NULL AND lower(ct.email) = c.email)
                 OR (length(c.tel9) = 9 AND right(regexp_replace(ct.telefono, '[^0-9]', '', 'g'), 9) = c.tel9)) AS citas,
              greatest(c.creado, max(p.creado)) AS actividad
             FROM clientes c LEFT JOIN pedidos p ON p.cliente_id = c.id
            GROUP BY c.id ORDER BY actividad DESC NULLS LAST LIMIT 500`)
  ]);
  enviar(res, 200, {
    resumen: { ...kpi.rows[0], anio },
    facturacionLista: emisorCompleto(),
    pedidos: pedidos.rows.map(p => ({ ...p, facturas: (p.facturas || []).map(f => ({ ...f, codigo: numeroFactura(f) })) })),
    clientes: clientes.rows
  });
}

async function ficha(res, id) {
  const c = await query('SELECT * FROM clientes WHERE id = $1', [id]);
  if (!c.rows.length) return enviar(res, 404, { error: 'No existe ese cliente.' });
  const cli = c.rows[0];
  const [pedidos, facturas, citas] = await Promise.all([
    query(`SELECT id, total, mensual, estado, origen, token, lineas, nota, creado FROM pedidos WHERE cliente_id = $1 ORDER BY id DESC`, [id]),
    query(`SELECT f.id, f.serie, f.numero, f.tipo, to_char(f.fecha, 'YYYY-MM-DD') AS fecha, f.total, f.pedido_id, p.token
             FROM facturas f JOIN pedidos p ON p.id = f.pedido_id WHERE p.cliente_id = $1 ORDER BY f.id DESC`, [id]),
    query(`SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora, modalidad, estado, origen
             FROM citas WHERE ($1::text IS NOT NULL AND lower(email) = $1)
                OR (length($2::text) = 9 AND right(regexp_replace(telefono, '[^0-9]', '', 'g'), 9) = $2::text)
            ORDER BY fecha DESC, hora DESC LIMIT 50`, [cli.email, cli.tel9 || ''])
  ]);
  enviar(res, 200, { cliente: cli, pedidos: pedidos.rows, facturas: facturas.rows.map(f => ({ ...f, codigo: numeroFactura(f) })), citas: citas.rows });
}

function leerCampos(b) {
  const d = {};
  for (const k of CAMPOS_CLIENTE) if (k in b) d[k] = texto(b[k], LIMITES[k]);
  if ('email' in d) d.email = d.email.toLowerCase();
  if ('nif' in d) d.nif = d.nif.toUpperCase();
  return d;
}

async function clienteNuevo(res, b) {
  const d = leerCampos(b);
  if (!d.nombre) return enviar(res, 400, { error: 'Falta el nombre.' });
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return enviar(res, 400, { error: 'El email no es válido.' });
  const { rows: [c] } = await query(
    `INSERT INTO clientes (nombre, email, telefono, negocio, nif, direccion, notas, origen)
     VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), 'panel') RETURNING *`,
    [d.nombre, d.email || '', d.telefono || '', d.negocio || '', d.nif || '', d.direccion || '', d.notas || '']);
  enviar(res, 201, { cliente: c });
}

async function editarCliente(res, b) {
  const id = Number(b.cliente);
  const d = leerCampos(b);
  const claves = Object.keys(d);
  if (!Number.isInteger(id) || !claves.length) return enviar(res, 400, { error: 'Datos no válidos.' });
  if ('nombre' in d && !d.nombre) return enviar(res, 400, { error: 'El nombre no puede quedar vacío.' });
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return enviar(res, 400, { error: 'El email no es válido.' });
  // Los nombres de columna salen de una lista fija; los valores van como parámetros
  const set = claves.map((k, i) => `${k} = NULLIF($${i + 2}, '')`).join(', ');
  const { rows } = await query(`UPDATE clientes SET ${set} WHERE id = $1 RETURNING *`, [id, ...claves.map(k => d[k])]);
  if (!rows.length) return enviar(res, 404, { error: 'No existe ese cliente.' });
  enviar(res, 200, { cliente: rows[0] });
}

async function pedidoManual(res, b) {
  const clienteId = Number(b.cliente_id);
  const p = calcularPedido(b.servicios, b.mantenimiento === true);
  if (!Number.isInteger(clienteId) || !p) return enviar(res, 400, { error: 'Elige el cliente y al menos un servicio.' });
  const c = await query('SELECT nombre, email, telefono, negocio, nif, direccion FROM clientes WHERE id = $1', [clienteId]);
  if (!c.rows.length) return enviar(res, 404, { error: 'No existe ese cliente.' });
  const { rows: [ped] } = await query(
    `INSERT INTO pedidos (cliente_id, lineas, base, iva, total, mensual, facturacion, nota, origen, token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), 'panel', $9) RETURNING *`,
    [clienteId, JSON.stringify(p.lineas), p.base, p.iva, p.total, p.mensual, JSON.stringify(c.rows[0]), texto(b.nota, 1000), nuevoToken()]);
  enviar(res, 201, { pedido: ped });
}

async function estadoPedido(res, b) {
  const id = Number(b.pedido);
  if (!Number.isInteger(id) || !ESTADOS_PEDIDO.includes(b.estado)) return enviar(res, 400, { error: 'Datos no válidos.' });
  const cobra = ['pagado', 'en_curso', 'entregado'].includes(b.estado);
  if (cobra && !emisorCompleto()) {
    return enviar(res, 409, { error: 'Para emitir facturas faltan tus datos fiscales: configura FACTURA_NIF y FACTURA_DIRECCION en Vercel.' });
  }
  const r = await transaccion(async q => {
    const { rows } = await q('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) return null;
    const p = rows[0];
    if (p.estado === 'cancelado' && b.estado !== 'cancelado') {
      const ya = await q(`SELECT 1 FROM facturas WHERE pedido_id = $1 AND tipo = 'rectificativa'`, [id]);
      if (ya.rows.length) return { error: 'Este pedido está anulado con factura rectificativa: crea un pedido nuevo.' };
    }
    let factura = null;
    if (cobra) factura = await emitirFactura(q, p, 'ordinaria');
    if (b.estado === 'cancelado') factura = await emitirFactura(q, p, 'rectificativa'); // null si nunca se facturó
    const { rows: [up] } = await q('UPDATE pedidos SET estado = $2 WHERE id = $1 RETURNING id, estado', [id, b.estado]);
    return { pedido: up, factura: factura && { ...factura, codigo: numeroFactura(factura) } };
  });
  if (!r) return enviar(res, 404, { error: 'No existe ese pedido.' });
  if (r.error) return enviar(res, 409, { error: r.error });
  enviar(res, 200, r);
}
