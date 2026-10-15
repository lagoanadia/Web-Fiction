// =============================================================
// Tests for the integrations (webhook for Make/Zapier/n8n, Notion and the .ics calendar),
// WITHOUT touching the real services: this script runs a fake receiver on port 3079.
// 1. Start the dev server with, besides DATABASE_URL and ADMIN_PASSWORD:
//      INTEGRACION_WEBHOOK_URL=http://127.0.0.1:3079/hook INTEGRACION_SECRETO=secreto-hook
//      NOTION_TOKEN=notion-prueba NOTION_DATABASE_ID=db1 NOTION_API_URL=http://127.0.0.1:3079/v1
//      CALENDARIO_TOKEN=calendario-de-prueba-123
// 2. Empty the tables (see crm-test.mjs) and run:  node tools/integraciones-test.mjs
// =============================================================
import http from 'node:http';
import crypto from 'node:crypto';
const B = process.env.BASE_URL || 'http://localhost:3077';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'OK   ' : 'FAIL ') + m); };
const hooks = [], pages = [];
const srv = http.createServer(async (req, res) => {
  let raw = ''; for await (const c of req) raw += c;
  if (req.url === '/hook') hooks.push({ body: raw, firma: req.headers['x-lagoa-firma'] });
  if (req.url === '/v1/databases/db1') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ properties: { 'Asunto': { type: 'title' }, Tipo: { type: 'select' }, Email: { type: 'email' }, 'Teléfono': { type: 'phone_number' }, Fecha: { type: 'date' }, Importe: { type: 'number' }, Detalle: { type: 'rich_text' } } }));
  }
  if (req.url === '/v1/pages') pages.push({ auth: req.headers.authorization, body: JSON.parse(raw) });
  res.end('{}');
}).listen(3079);
const post = (p, body) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// Cita
const disp = await (await fetch(B + '/api/disponibilidad')).json();
const pad = n => String(n).padStart(2, '0');
let hueco;
for (let i = 2; i <= 14 && !hueco; i++) { const d = new Date(Date.now() + i * 864e5); const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; const h = (disp.horario[d.getDay()] || [])[0]; if (h && !disp.ocupados.includes(`${iso} ${h}`)) hueco = [iso, h]; }
let r = await post('/api/reservas', { fecha: hueco[0], hora: hueco[1], modalidad: 'Videollamada', nombre: 'Antía, "la de la tienda"', telefono: '600 999 888', email: 'antia@ejemplo.es', nota: 'Línea 1\nLínea 2; con coma, y punto', privacidad: true });
ok(r.status === 201, 'reserva → 201');
await post('/api/mensajes', { nombre: 'Brais', email: 'brais@ejemplo.es', servicio: 'Asistente de WhatsApp', mensaje: '¿Funciona con mi número?', privacidad: true });
// Tras la llamada, Nadia crea el presupuesto en el panel
const login = await fetch(B + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'contrasena-de-prueba' }) });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const crm = await (await fetch(B + '/api/admin/crm', { headers: { cookie } })).json();
const brais = crm.clientes.find(c => c.nombre === 'Brais');
await fetch(B + '/api/admin/crm', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ cliente_id: brais.id, lineas: [{ concepto: 'Google Maps y SEO local', importe: 120 }] }) });

const ev = hooks.map(h => JSON.parse(h.body));
ok(hooks.length === 3 && ev.map(e => e.evento).join() === 'cita.nueva,mensaje.nuevo,pedido.nuevo', `webhook recibe los 3 eventos en orden (${ev.map(e => e.evento)})`);
ok(ev[0].datos.fecha === hueco[0] && ev[0].datos.hora === hueco[1] && ev[0].datos.email === 'antia@ejemplo.es', 'webhook: la cita lleva día, hora y contacto');
ok(ev[2].datos.importe === 120 && ev[2].datos.enlace.includes('/documento/?p='), 'webhook: el presupuesto lleva importe y enlace al documento');
const firmaOk = hooks.every(h => h.firma === 'sha256=' + crypto.createHmac('sha256', 'secreto-hook').update(h.body).digest('hex'));
ok(firmaOk, 'webhook: cada envío va firmado (X-Lagoa-Firma) con INTEGRACION_SECRETO');

ok(pages.length === 3 && pages.every(p => p.auth === 'Bearer notion-prueba'), 'Notion: 3 filas creadas con el token');
const p0 = pages[0].body;
ok(p0.parent.database_id === 'db1' && p0.properties.Asunto.title[0].text.content.startsWith('Cita nueva'), 'Notion: el título va en la columna de tipo título, se llame como se llame');
ok(p0.properties.Fecha.date.start === `${hueco[0]}T${hueco[1]}:00` && p0.properties.Email.email === 'antia@ejemplo.es', 'Notion: fecha y email en sus columnas');
ok(!('Estado' in p0.properties) && !('Negocio' in p0.properties), 'Notion: no envía columnas que tu base de datos no tiene');
ok(pages[2].body.properties.Importe.number === 120, 'Notion: importe del presupuesto como número');

// Calendario .ics
r = await fetch(B + '/api/calendario?t=mal');
ok(r.status === 404, 'calendario con token incorrecto → 404');
r = await fetch(B + '/api/calendario?t=calendario-de-prueba-123');
const icsRaw = await r.text();
const ics = icsRaw.replace(/\r\n /g, ''); // las líneas largas van partidas: se unen para buscar
ok(r.status === 200 && r.headers.get('content-type').startsWith('text/calendar'), 'calendario → text/calendar');
ok(ics.includes('BEGIN:VEVENT') && ics.includes('Consulta · Antía\\, "la de la tienda"'), 'calendario: la cita aparece con el texto escapado');
ok(ics.includes('Línea 1\\nLínea 2\\; con coma\\, y punto'), 'calendario: saltos de línea, ; y , escapados');
ok(icsRaw.split('\r\n').every(l => l.length <= 75), 'calendario: ninguna línea pasa de 75 caracteres');
const d = new Date(`${hueco[0]}T12:00:00Z`);
const verano = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'short' }).format(d).includes('+2');
const hUtc = String(+hueco[1].slice(0, 2) - (verano ? 2 : 1)).padStart(2, '0');
ok(ics.includes(`DTSTART:${hueco[0].replace(/-/g, '')}T${hUtc}${hueco[1].slice(3)}00Z`), `calendario: hora convertida a UTC correctamente (${hueco[1]} Madrid)`);

srv.close();
console.log(fails ? `\n${fails} FAIL` : '\nTodo OK');
process.exit(fails ? 1 : 0);
