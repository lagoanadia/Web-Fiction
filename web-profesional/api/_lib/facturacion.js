/* =============================================================
   Pedidos y facturas
   - Sin precios fijos: cada presupuesto lo escribe Nadia en el panel
     (concepto + importe con IVA) después de la llamada con el cliente.
   - Todo en céntimos. Los importes que se escriben llevan el IVA (21 %).
   - Datos del emisor en variables de entorno (Vercel):
       FACTURA_NOMBRE, FACTURA_NIF, FACTURA_DIRECCION,
       FACTURA_EMAIL, FACTURA_IBAN (opcional, para el pago)
   ============================================================= */
import crypto from 'node:crypto';

export const IVA = 0.21;
export const ESTADOS_PEDIDO = ['pendiente_pago', 'pagado', 'en_curso', 'entregado', 'cancelado'];

/**
 * Presupuesto a partir de las líneas que escribe Nadia en el panel.
 * lineas: [{ concepto, importe }] con el importe en euros, IVA incluido.
 * mensual: cuota de mantenimiento en euros/mes (opcional, se factura aparte).
 * Devuelve null si no hay ninguna línea válida.
 */
export function presupuestoDesdeLineas(lineas, mensual = 0) {
  if (!Array.isArray(lineas)) return null;
  const validas = lineas.slice(0, 30)
    .map(l => ({ concepto: String(l?.concepto || '').trim().slice(0, 200), cent: Math.round(Number(l?.importe) * 100) }))
    .filter(l => l.concepto && Number.isFinite(l.cent) && l.cent > 0 && l.cent <= 100000000);
  if (!validas.length) return null;
  const lin = validas.map(l => linea(l.concepto, l.cent));
  const m = Math.round(Number(mensual) * 100);
  return { lineas: lin, mensual: Number.isFinite(m) && m > 0 && m <= 10000000 ? m : 0, ...sumar(lin) };
}

/** Una línea con su base e IVA, a partir del precio final (IVA incluido) */
export function linea(concepto, totalCent, id = null) {
  const base = Math.round(totalCent / (1 + IVA));
  return { id, concepto, cantidad: 1, base, iva: totalCent - base, total: totalCent };
}
export const sumar = lineas => ({
  base: lineas.reduce((a, l) => a + l.base, 0),
  iva: lineas.reduce((a, l) => a + l.iva, 0),
  total: lineas.reduce((a, l) => a + l.total, 0)
});

export const nuevoToken = () => crypto.randomBytes(24).toString('base64url');
export function tokenIgual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

export function emisor() {
  return {
    nombre: process.env.FACTURA_NOMBRE || 'Nadia Lagoa Vilela (Lagoa · Estudio digital)',
    nif: process.env.FACTURA_NIF || '',
    direccion: process.env.FACTURA_DIRECCION || '',
    email: process.env.FACTURA_EMAIL || 'nadialavi.work@gmail.com',
    iban: process.env.FACTURA_IBAN || ''
  };
}
/** Una factura legal necesita el NIF y la dirección del emisor */
export const emisorCompleto = () => { const e = emisor(); return Boolean(e.nif && e.direccion); };
export const numeroFactura = f => `${f.serie}-${String(f.numero).padStart(4, '0')}`;

/** Fecha de hoy en España "AAAA-MM-DD" */
const hoyEspana = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

/**
 * Emite la factura de un pedido dentro de una transacción (q = consulta de la transacción).
 * tipo 'ordinaria' al cobrar; 'rectificativa' (importes en negativo) al anular uno ya facturado.
 * El bloqueo garantiza que dos facturas a la vez no cojan el mismo número.
 */
export async function emitirFactura(q, pedido, tipo = 'ordinaria') {
  const ya = await q('SELECT * FROM facturas WHERE pedido_id = $1 AND tipo = $2', [pedido.id, tipo]);
  if (ya.rows.length) return ya.rows[0];
  const fecha = hoyEspana();
  const serie = (tipo === 'rectificativa' ? 'R' : 'F') + fecha.slice(0, 4);
  await q('SELECT pg_advisory_xact_lock(424242)');
  const { rows: [{ n }] } = await q('SELECT coalesce(max(numero), 0) + 1 AS n FROM facturas WHERE serie = $1', [serie]);
  let lineas = pedido.lineas, rectifica = null;
  if (tipo === 'rectificativa') {
    const orig = await q(`SELECT * FROM facturas WHERE pedido_id = $1 AND tipo = 'ordinaria'`, [pedido.id]);
    if (!orig.rows.length) return null;
    rectifica = orig.rows[0].id;
    lineas = orig.rows[0].lineas.map(l => ({ ...l, concepto: `Anulación: ${l.concepto}`, base: -l.base, iva: -l.iva, total: -l.total }));
  }
  const t = sumar(lineas);
  const { rows: [f] } = await q(
    `INSERT INTO facturas (serie, numero, tipo, rectifica, pedido_id, fecha, emisor, cliente, lineas, base, iva, total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [serie, n, tipo, rectifica, pedido.id, fecha, JSON.stringify(emisor()), JSON.stringify(pedido.facturacion), JSON.stringify(lineas), t.base, t.iva, t.total]
  );
  return f;
}
