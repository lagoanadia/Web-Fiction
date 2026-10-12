/* =============================================================
   GET /api/documento?p=<pedido>&t=<token>  (pública, con enlace privado)
   Devuelve lo que necesita /documento para mostrar la factura proforma
   del pedido y, si ya existen, sus facturas. Sin el token correcto no
   se ve nada (y no se distingue "no existe" de "token incorrecto").
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, parametros, fallo } from './_lib/http.js';
import { emisor, tokenIgual, numeroFactura } from './_lib/facturacion.js';

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET'])) return;
  const p = parametros(req);
  const id = Number(p.get('p'));
  if (!Number.isInteger(id) || id <= 0) return enviar(res, 404, { error: 'Documento no encontrado.' });
  try {
    const { rows } = await query(
      `SELECT id, lineas, base, iva, total, mensual, facturacion, estado, token, to_char(creado AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS fecha
         FROM pedidos WHERE id = $1`, [id]);
    if (!rows.length || !tokenIgual(rows[0].token, p.get('t'))) return enviar(res, 404, { error: 'Documento no encontrado.' });
    const { token, ...pedido } = rows[0];
    const f = await query(
      `SELECT id, serie, numero, tipo, rectifica, to_char(fecha, 'YYYY-MM-DD') AS fecha, emisor, cliente, lineas, base, iva, total
         FROM facturas WHERE pedido_id = $1 ORDER BY id`, [id]);
    const facturas = f.rows.map(x => ({ ...x, codigo: numeroFactura(x) }));
    const porId = Object.fromEntries(facturas.map(x => [x.id, x.codigo]));
    facturas.forEach(x => { if (x.rectifica) x.rectificaCodigo = porId[x.rectifica]; });
    enviar(res, 200, { pedido, facturas, emisor: emisor() });
  } catch (e) {
    fallo(res, e);
  }
}
