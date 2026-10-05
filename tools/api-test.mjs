// =============================================================
// Automatic tests for the booking API (run them before every deploy).
// 1. Start a local Postgres and the dev server (see the tutorial).
// 2. Empty the tables:  psql "$DATABASE_URL" -c "TRUNCATE citas, bloqueos RESTART IDENTITY;"
// 3. Run:  ADMIN_PASSWORD=a-long-test-password node tools/api-test.mjs
// Every line must start with OK. Never run this against a real client's database.
// =============================================================
const PASSWORD = process.env.ADMIN_PASSWORD || 'contrasena-de-prueba';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3077';
const B = BASE_URL;
let cookie = '';
const call = async (p, { method = 'GET', body, auth = false, headers = {} } = {}) => {
  const h = { ...headers }; if (body !== undefined) h['Content-Type'] = 'application/json'; if (auth && cookie) h.cookie = cookie;
  const r = await fetch(B + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc && sc.startsWith('lagoa_admin=')) cookie = sc.split(';')[0];
  return { s: r.status, d: await r.json().catch(() => ({})), sc };
};
const ok = (cond, msg) => console.log((cond ? 'OK   ' : 'FAIL ') + msg);
const pad = n => String(n).padStart(2, '0');

// Buscar huecos válidos (más de 12 h vista) usando el horario del servidor
const disp = (await call('/api/disponibilidad')).d;
const libres = [];
const now = Date.now();
for (let i = 1; i <= 14 && libres.length < 12; i++) {
  const d = new Date(now + i * 864e5); const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  for (const h of disp.horario[d.getDay()] || []) libres.push([iso, h]);
}
const [f1, h1] = libres[0], [f2, h2] = libres[1], [f3, h3] = libres[2], [f4, h4] = libres[3], [f5, h5] = libres[4];
const base = { modalidad: 'Videollamada', nombre: 'Prueba Uno', negocio: 'Peluquería', telefono: '600 111 222', email: 'a@b.es', nota: 'hola', privacidad: true };

let r = await call('/api/reservas', { method: 'POST', body: { ...base, fecha: f1, hora: h1 } });
ok(r.s === 201, 'reserva válida → 201 ' + JSON.stringify(r.d));
r = await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '611000000', fecha: f1, hora: h1 } });
ok(r.s === 409, 'misma hora otra vez → 409 ' + r.d.error);
r = await call('/api/reservas', { method: 'POST', body: { ...base, fecha: f1, hora: '03:00' } });
ok(r.s === 400, 'hora fuera de horario → 400');
r = await call('/api/reservas', { method: 'POST', body: { ...base, fecha: '2020-01-06', hora: '16:00' } });
ok(r.s === 400, 'fecha pasada → 400');
r = await call('/api/reservas', { method: 'POST', body: { ...base, fecha: f2, hora: h2, privacidad: false } });
ok(r.s === 400, 'sin aceptar privacidad → 400');
r = await call('/api/reservas', { method: 'POST', body: { ...base, fecha: f2, hora: h2, telefono: 'abc' } });
ok(r.s === 400, 'teléfono no válido → 400');
r = await call('/api/reservas', { method: 'POST', body: { ...base, fecha: f2, hora: h2, _honey: 'spam' } });
ok(r.s === 201, 'robot (campo trampa) → finge éxito');
r = await fetch(B + '/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'fecha=x' });
ok(r.status === 415, 'formulario no JSON → 415');
r = await call('/api/reservas');
ok(r.s === 405, 'GET a /api/reservas → 405');
r = await call('/api/disponibilidad');
ok(r.d.ocupados.includes(`${f1} ${h1}`) && !r.d.ocupados.includes(`${f2} ${h2}`), 'disponibilidad marca solo la hora reservada (el robot no ocupó nada)');
ok(!JSON.stringify(r.d).includes('Prueba'), 'disponibilidad no expone datos personales');

// límite por teléfono
await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '+34 600111222', fecha: f2, hora: h2 } });
r = await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '600-111-222', fecha: f3, hora: h3 } });
ok(r.s === 429, 'tercera cita con el mismo teléfono (otro formato) → 429');

// concurrencia: 6 reservas a la vez en la misma hora
const res = await Promise.all([...Array(6)].map((_, i) => call('/api/reservas', { method: 'POST', body: { ...base, telefono: `62000000${i}`, fecha: f4, hora: h4 } })));
const codes = res.map(x => x.s).sort();
ok(codes.filter(c => c === 201).length === 1 && codes.filter(c => c === 409).length === 5, '6 reservas simultáneas misma hora → 1 guardada, 5 rechazadas ' + codes.join(','));

// ---------- panel ----------
r = await call('/api/admin/citas', { auth: true });
ok(r.s === 401, 'panel sin sesión → 401');
let t0 = Date.now(); r = await call('/api/admin/login', { method: 'POST', body: { password: 'mala' } });
ok(r.s === 401 && Date.now() - t0 >= 750, 'contraseña incorrecta → 401 con espera');
r = await call('/api/admin/login', { method: 'POST', body: { password: PASSWORD } });
ok(r.s === 200 && /HttpOnly/.test(r.sc) && /SameSite=Strict/.test(r.sc) && /Secure/.test(r.sc), 'login correcto → cookie HttpOnly/Secure/SameSite');
r = await call('/api/admin/sesion', { auth: true });
ok(r.d.activa === true, 'sesión activa');
const tampered = cookie.replace(/.$/, c => (c === 'A' ? 'B' : 'A'));
r = await fetch(B + '/api/admin/citas', { headers: { cookie: tampered } });
ok(r.status === 401, 'cookie manipulada → 401');
const forged = 'lagoa_admin=' + Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url') + '.xxxx';
r = await fetch(B + '/api/admin/citas', { headers: { cookie: forged } });
ok(r.status === 401, 'cookie inventada → 401');

r = await call(`/api/admin/citas?desde=${f1}&hasta=${f5}`, { auth: true });
const c1 = r.d.citas.find(c => c.fecha === f1 && c.hora === h1);
ok(r.s === 200 && c1 && c1.nombre === 'Prueba Uno' && c1.estado === 'pendiente', 'panel lista la cita con sus datos ' + r.d.citas.length + ' citas, pendientes ' + r.d.pendientesTotal);
r = await call('/api/admin/citas', { method: 'PATCH', auth: true, body: { id: c1.id, estado: 'confirmada' } });
ok(r.s === 200 && r.d.cita.estado === 'confirmada', 'confirmar cita');
r = await call('/api/admin/citas', { method: 'PATCH', auth: true, body: { id: c1.id, estado: 'borrada' } });
ok(r.s === 400, 'estado inventado → 400');

// bloquear y desbloquear
r = await call('/api/admin/bloqueos', { method: 'POST', auth: true, body: { fecha: f5, hora: h5 } });
ok(r.s === 201, 'bloquear hueco');
r = await call('/api/admin/bloqueos', { method: 'POST', auth: true, body: { fecha: f1, hora: h1 } });
ok(r.s === 409, 'bloquear hueco con cita → 409');
r = await call('/api/disponibilidad');
ok(r.d.ocupados.includes(`${f5} ${h5}`), 'hueco bloqueado desaparece de la web');
r = await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '633000000', fecha: f5, hora: h5 } });
ok(r.s === 409, 'reservar hueco bloqueado → 409');
r = await call(`/api/admin/bloqueos?fecha=${f5}&hora=${h5}`, { method: 'DELETE', auth: true });
ok(r.s === 200, 'desbloquear');
r = await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '633000000', fecha: f5, hora: h5 } });
ok(r.s === 201, 'tras desbloquear se puede reservar');

// cancelar libera el hueco
r = await call('/api/admin/citas', { method: 'PATCH', auth: true, body: { id: c1.id, estado: 'cancelada' } });
ok(r.d.cita.estado === 'cancelada', 'cancelar cita');
r = await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '644000000', fecha: f1, hora: h1 } });
ok(r.s === 201, 'hueco cancelado vuelve a estar libre');
r = await call('/api/admin/citas', { method: 'PATCH', auth: true, body: { id: c1.id, estado: 'pendiente' } });
ok(r.s === 409, 'reactivar cita cuyo hueco ya está cogido → 409');

// cita a mano
r = await call('/api/admin/citas', { method: 'POST', auth: true, body: { fecha: f1, hora: '20:15', nombre: 'Llamada de Ana', telefono: '655000000' } });
ok(r.s === 201 && r.d.cita.estado === 'confirmada' && r.d.cita.origen === 'panel', 'cita añadida a mano (fuera de horario)');
r = await call('/api/admin/citas', { method: 'POST', auth: true, body: { fecha: 'mañana', hora: '20:15', nombre: 'x' } });
ok(r.s === 400, 'cita a mano con fecha no válida → 400');
// CSRF: sin JSON no se aceptan cambios
r = await fetch(B + '/api/admin/citas', { method: 'PATCH', headers: { cookie, 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: c1.id, estado: 'confirmada' }) });
ok(r.status === 415, 'cambio sin JSON (posible ataque desde otra web) → 415');
// inyección SQL
r = await call(`/api/admin/citas?desde=${encodeURIComponent("2026-01-01' OR 1=1 --")}`, { auth: true });
ok(r.s === 200, 'parámetro con SQL malicioso se ignora (se valida el formato)');
r = await call('/api/reservas', { method: 'POST', body: { ...base, telefono: '699000000', nombre: "Robert'); DROP TABLE citas;--", fecha: libres[6][0], hora: libres[6][1] } });
ok(r.s === 201, 'nombre con SQL se guarda como texto normal');
r = await call(`/api/admin/citas?desde=${f1}&hasta=${libres[11][0]}`, { auth: true });
ok(r.s === 200 && r.d.citas.some(c => c.nombre.includes('DROP TABLE')), 'la tabla sigue ahí y el texto se guardó tal cual');
r = await call('/api/admin/logout', { method: 'POST', auth: true });
const after = await fetch(B + '/api/admin/sesion', { headers: { cookie: (r.sc || '').split(';')[0] } }).then(x => x.json());
ok(/Max-Age=0/.test(r.sc) && after.activa === false, 'salir borra la sesión');

