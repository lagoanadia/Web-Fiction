// =============================================================
// Automatic tests for orders, invoices and the CRM.
// 1. Start Postgres and the dev server with, besides DATABASE_URL and ADMIN_PASSWORD:
//      FACTURA_NIF=12345678Z FACTURA_DIRECCION="Rúa Exemplo 1, 15001 A Coruña"
// 2. Empty the tables:
//      psql "$DATABASE_URL" -c "TRUNCATE mensajes, facturas, pedidos, clientes, citas, bloqueos RESTART IDENTITY CASCADE;"
// 3. Run:  ADMIN_PASSWORD=… node tools/crm-test.mjs
// Every line must start with OK. Never run this against a real client's database.
// =============================================================
const PASSWORD = process.env.ADMIN_PASSWORD || 'contrasena-de-prueba';
const B = process.env.BASE_URL || 'http://localhost:3077';
let cookie = '';
const call = async (p, { method = 'GET', body, auth = false } = {}) => {
  const h = {}; if (body !== undefined) h['Content-Type'] = 'application/json'; if (auth && cookie) h.cookie = cookie;
  const r = await fetch(B + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('lagoa_admin=')) cookie = sc.split(';')[0];
  return { s: r.status, d: await r.json().catch(() => ({})) };
};
let fails = 0;
const ok = (cond, msg) => { if (!cond) fails++; console.log((cond ? 'OK   ' : 'FAIL ') + msg); };

const cliente = { nombre: 'Peluquería Uxía SL', email: 'Uxia@Example.com', telefono: '600 111 222', negocio: 'Peluquería Uxía', nif: 'b12345678', direccion: 'Rúa Real 1, Lugo' };

// --- El cliente reserva la llamada de presupuesto: así entra en el CRM ---
const disp = (await call('/api/disponibilidad')).d;
const pad = n => String(n).padStart(2, '0');
const huecos = [];
for (let i = 2; i <= 14 && huecos.length < 2; i++) { const d = new Date(Date.now() + i * 864e5); const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; const h = (disp.horario[d.getDay()] || [])[0]; if (h && !disp.ocupados.includes(`${iso} ${h}`)) huecos.push([iso, h]); }
let r = await call('/api/reservas', { method: 'POST', body: { fecha: huecos[0][0], hora: huecos[0][1], modalidad: 'Videollamada', nombre: cliente.nombre, negocio: cliente.negocio, telefono: cliente.telefono, email: cliente.email, nota: 'Me interesa: Web con reservas, Asistente de WhatsApp', privacidad: true } });
ok(r.s === 201, 'reserva de la llamada de presupuesto → 201');
r = await call('/api/reservas', { method: 'POST', body: { fecha: huecos[1][0], hora: huecos[1][1], modalidad: 'Videollamada', nombre: 'Intruso', telefono: '+34 600111222', email: 'uxia@example.com', privacidad: true } });
ok(r.s === 201, 'otra reserva con el mismo teléfono (otro formato) → 201');

// --- CRM ---
r = await call('/api/admin/crm');
ok(r.s === 401, 'CRM sin sesión → 401');
await call('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
r = await call('/api/admin/crm', { auth: true });
ok(r.s === 200 && r.d.clientes.length === 1, `un solo cliente en el CRM (${r.d.clientes?.length})`);
ok(r.d.clientes[0].nombre === 'Peluquería Uxía SL', 'la reserva de "Intruso" no cambió el nombre de la ficha');
ok(r.d.facturacionLista === true, 'datos fiscales del emisor configurados');
const cid = r.d.clientes[0].id;
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { cliente: cid, nif: cliente.nif, direccion: cliente.direccion } });
ok(r.s === 200 && r.d.cliente.nif === 'B12345678', 'datos fiscales del cliente guardados en su ficha (NIF en mayúsculas)');

// --- Presupuestos tras la llamada: conceptos e importes libres ---
const presupuesto = (lineas, extra = {}) => call('/api/admin/crm', { method: 'POST', auth: true, body: { cliente_id: cid, lineas, ...extra } });
r = await presupuesto([{ concepto: 'Web + WhatsApp (misma agenda)', importe: 430 }, { concepto: 'Google Maps y SEO local', importe: 120 }], { mensual: 29 });
ok(r.s === 201 && r.d.pedido.total === 55000 && r.d.pedido.mensual === 2900, `presupuesto de 2 conceptos = 550 € + 29 €/mes (${r.d.pedido?.total})`);
ok(r.d.pedido.lineas.every(l => l.base + l.iva === l.total), 'cada línea desglosa base + IVA');
const p1 = r.d.pedido;
r = await presupuesto([]);
ok(r.s === 400, 'presupuesto sin conceptos → 400');
r = await presupuesto([{ concepto: 'Algo', importe: -5 }]);
ok(r.s === 400, 'importe negativo → 400');
r = await presupuesto([{ concepto: '', importe: 50 }]);
ok(r.s === 400, 'concepto vacío → 400');
const p2 = (await presupuesto([{ concepto: 'Tienda online', importe: 390 }])).d.pedido;
const p3 = (await presupuesto([{ concepto: 'Google Maps y SEO local', importe: 120 }])).d.pedido;

// --- El cliente ve su presupuesto con el enlace privado ---
r = await call(`/api/documento?p=${p1.id}&t=${p1.token}`);
ok(r.s === 200 && r.d.pedido.total === 55000 && r.d.facturas.length === 0, 'documento: presupuesto visible con el enlace');
ok(!('token' in r.d.pedido), 'documento: no devuelve el token');
r = await call(`/api/documento?p=${p1.id}&t=otro`);
ok(r.s === 404, 'documento con token incorrecto → 404');

r = await call('/api/admin/crm', { auth: true });
ok(r.d.resumen.pendientes === 3 && r.d.resumen.por_cobrar === 55000 + 39000 + 12000, 'resumen: 3 presupuestos pendientes y lo que falta por cobrar');
r = await call(`/api/admin/crm?cliente=${cid}`, { auth: true });
ok(r.d.citas.length === 2 && r.d.pedidos.length === 3, 'ficha: 3 presupuestos y 2 citas');

// --- Factura al cobrar: correlativa ---
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { pedido: p1.id, estado: 'pagado' } });
const y = new Date().getFullYear();
ok(r.s === 200 && r.d.factura.codigo === `F${y}-0001`, `pagado → factura F${y}-0001 (${r.d.factura?.codigo})`);
ok(r.d.factura.total === 55000 && r.d.factura.base + r.d.factura.iva === 55000, 'factura: base + IVA = total');
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { pedido: p1.id, estado: 'en_curso' } });
ok(r.d.factura.codigo === `F${y}-0001`, 'cambiar a "en curso" no emite otra factura');
const [a, b2] = await Promise.all([
  call('/api/admin/crm', { method: 'PATCH', auth: true, body: { pedido: p2.id, estado: 'pagado' } }),
  call('/api/admin/crm', { method: 'PATCH', auth: true, body: { pedido: p3.id, estado: 'pagado' } })
]);
const nums = [a.d.factura.numero, b2.d.factura.numero].sort();
ok(nums.join() === '2,3', `dos cobros a la vez → números 2 y 3, sin repetir (${nums})`);
r = await call(`/api/documento?p=${p1.id}&t=${p1.token}`);
ok(r.d.facturas.length === 1 && r.d.facturas[0].emisor.nif === '12345678Z' && r.d.facturas[0].cliente.nif === 'B12345678', 'el cliente ve su factura con NIF de emisor y receptor');

// --- Anular uno ya facturado → rectificativa ---
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { pedido: p3.id, estado: 'cancelado' } });
ok(r.s === 200 && r.d.factura.codigo === `R${y}-0001` && r.d.factura.total === -12000, 'anular pedido facturado → rectificativa R-0001 en negativo');
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { pedido: p3.id, estado: 'pagado' } });
ok(r.s === 409, 'un pedido rectificado no se puede volver a cobrar');
r = await call('/api/admin/crm', { auth: true });
ok(r.d.resumen.facturado === 55000 + 39000, `facturado neto del año = 940 € (${r.d.resumen.facturado / 100})`);

// --- Ficha: editar, cliente y pedido a mano ---
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { cliente: cid, notas: 'Quiere fotos nuevas en primavera' } });
ok(r.s === 200 && r.d.cliente.notas.startsWith('Quiere'), 'notas guardadas');
r = await call('/api/admin/crm', { method: 'POST', auth: true, body: { cliente: { nombre: 'Bar O Porto', telefono: '611 222 333' } } });
ok(r.s === 201, 'cliente nuevo a mano');
r = await call('/api/admin/crm', { method: 'POST', auth: true, body: { cliente_id: r.d.cliente.id, lineas: [{ concepto: 'Ficha de Google', importe: '120.50' }] } });
ok(r.s === 201 && r.d.pedido.origen === 'panel' && r.d.pedido.total === 12050, 'presupuesto para un cliente creado a mano (importe con decimales)');
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { cliente: cid, email: 'otro' } });
ok(r.s === 400, 'email no válido al editar → 400');

// --- Mensajes del formulario de contacto ---
r = await call('/api/mensajes', { method: 'POST', body: { nombre: 'Uxía', email: 'UXIA@example.com', telefono: '600111222', servicio: 'Tienda online', mensaje: '¿Hacéis tiendas con recogida?', privacidad: true } });
ok(r.s === 201, 'mensaje de contacto → 201');
r = await call('/api/mensajes', { method: 'POST', body: { nombre: 'X', email: 'x@y.es', mensaje: '', privacidad: true } });
ok(r.s === 400, 'mensaje vacío → 400');
r = await call('/api/mensajes', { method: 'POST', body: { nombre: 'Bot', email: 'b@b.es', mensaje: 'spam', privacidad: true, _honey: 'x' } });
ok(r.s === 201, 'robot (campo trampa) → finge éxito');
r = await call('/api/admin/crm', { auth: true });
ok(r.d.mensajes.length === 1 && r.d.resumen.sin_leer === 1, 'el mensaje está en el panel, sin leer (el del robot no)');
ok(r.d.mensajes[0].cliente_id === cid, 'el mensaje se une a la ficha del cliente que ya existía (mismo email)');
const mid = r.d.mensajes[0].id;
r = await call('/api/admin/crm', { method: 'PATCH', auth: true, body: { mensaje: mid, leido: true } });
ok(r.s === 200 && r.d.mensaje.leido === true, 'marcar como leído');
r = await call(`/api/admin/crm?cliente=${cid}`, { auth: true });
ok(r.d.mensajes.length === 1, 'la ficha muestra el mensaje');
r = await call('/api/mensajes', { method: 'POST', body: { nombre: 'Nueva', email: 'nueva@ejemplo.es', mensaje: 'Hola', privacidad: true } });
r = await call('/api/admin/crm', { auth: true });
ok(r.d.clientes.some(c => c.nombre === 'Nueva'), 'un mensaje de alguien nuevo crea su ficha');
for (let i = 0; i < 6; i++) r = await call('/api/mensajes', { method: 'POST', body: { nombre: 'Spam', email: 'spam@ejemplo.es', mensaje: 'x' + i, privacidad: true } });
ok(r.s === 429, 'sexto mensaje en una hora del mismo email → 429');

console.log(fails ? `\n${fails} FAIL` : '\nTodo OK');
process.exit(fails ? 1 : 0);
