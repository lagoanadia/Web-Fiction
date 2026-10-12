/* =============================================================
   POST /api/pedidos  (pública)
   El cliente contrata servicios desde la web. El servidor:
   1. calcula el importe con SUS precios (nunca los del navegador),
   2. crea o completa la ficha del cliente en el CRM,
   3. guarda el pedido "pendiente de pago" con un enlace privado
      donde el cliente ve su factura proforma (y luego la factura).
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, cuerpo, esJson, fallo, texto } from './_lib/http.js';
import { calcularPedido, nuevoToken } from './_lib/facturacion.js';
import { buscarOCrearCliente } from './_lib/clientes.js';
import { notificar } from './_lib/integraciones.js';
import { WEB } from './_lib/negocio.js';

const MAX_PENDIENTES = 3; // pedidos sin pagar a la vez por cliente (frena el spam)

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  const b = cuerpo(req);
  if (!b) return enviar(res, 400, { error: 'Datos no válidos.' });
  if (b._honey) return enviar(res, 201, { ok: true }); // robot: fingimos que ha ido bien

  const c = b.cliente || {};
  const f = {
    nombre: texto(c.nombre, 120), email: texto(c.email, 160).toLowerCase(), telefono: texto(c.telefono, 30),
    negocio: texto(c.negocio, 120), nif: texto(c.nif, 20).toUpperCase(), direccion: texto(c.direccion, 240)
  };
  const pedido = calcularPedido(b.servicios, b.mantenimiento === true);

  const errores = [];
  if (!pedido) errores.push('Elige al menos un servicio.');
  if (f.nombre.length < 2) errores.push('Falta el nombre o razón social.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errores.push('El email no es válido.');
  if (!/^\+?[\d\s().-]{6,}$/.test(f.telefono)) errores.push('El teléfono no es válido.');
  if (f.nif && !/^[A-Z0-9-]{5,20}$/.test(f.nif)) errores.push('El NIF/CIF no es válido.');
  if (b.privacidad !== true) errores.push('Debes aceptar la política de privacidad y las condiciones.');
  if (errores.length) return enviar(res, 400, { error: errores.join(' ') });

  try {
    const clienteId = await buscarOCrearCliente(f, 'pedido');
    const { rows: [{ n }] } = await query(
      `SELECT count(*)::int AS n FROM pedidos WHERE cliente_id = $1 AND estado = 'pendiente_pago'`, [clienteId]);
    if (n >= MAX_PENDIENTES) return enviar(res, 429, { error: 'Ya tienes pedidos pendientes. Te escribimos enseguida para cerrarlos.' });

    const token = nuevoToken();
    const { rows: [p] } = await query(
      `INSERT INTO pedidos (cliente_id, lineas, base, iva, total, mensual, facturacion, nota, origen, token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), 'web', $9) RETURNING id, total, mensual`,
      [clienteId, JSON.stringify(pedido.lineas), pedido.base, pedido.iva, pedido.total, pedido.mensual, JSON.stringify(f), texto(b.nota, 1000), token]
    );
    await notificar('pedido.nuevo', { id: p.id, nombre: f.nombre, email: f.email, telefono: f.telefono, negocio: f.negocio, estado: 'pendiente de pago', importe: p.total / 100, detalle: pedido.lineas.map(l => l.concepto).join(' · '), enlace: `${WEB}/documento/?p=${p.id}&t=${token}` });
    enviar(res, 201, { ok: true, pedido: p.id, token, total: p.total, mensual: p.mensual, lineas: pedido.lineas });
  } catch (e) {
    fallo(res, e);
  }
}
