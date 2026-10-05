// =============================================================
// Automatic tests for the WhatsApp bot, WITHOUT touching real WhatsApp.
// This script pretends to be Meta in both directions:
//   - it sends signed webhook messages to /api/whatsapp (like Meta does)
//   - it runs a fake "Graph API" on port 3078 that records what the bot sends
// 1. Start the dev server with these variables (see the tutorial):
//      WHATSAPP_TOKEN=token-de-prueba WHATSAPP_PHONE_ID=PHONE1
//      WHATSAPP_VERIFY_TOKEN=verifica-esto WHATSAPP_APP_SECRET=secreto-app
//      WHATSAPP_API_URL=http://127.0.0.1:3078/v23.0
// 2. Empty the tables:
//      psql "$DATABASE_URL" -c "TRUNCATE citas, bloqueos, wa_chats, wa_mensajes RESTART IDENTITY;"
// 3. Run:  ADMIN_PASSWORD=… node tools/whatsapp-test.mjs
// Every line must start with OK. Never run this against a real client's database.
// =============================================================
import http from 'node:http';
import crypto from 'node:crypto';

const B = process.env.BASE_URL || 'http://localhost:3077';
const SECRET = process.env.WHATSAPP_APP_SECRET || 'secreto-app';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || 'PHONE1';
const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || 'verifica-esto';
const PASSWORD = process.env.ADMIN_PASSWORD || 'contrasena-de-prueba';

let fallos = 0;
const ok = (cond, msg) => { if (!cond) fallos++; console.log((cond ? 'OK   ' : 'FAIL ') + msg); };

// ---------- Fake Meta Graph API: records every message the bot sends ----------
let enviados = [];
let n = 0;
const graph = http.createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  const body = JSON.parse(raw || '{}');
  enviados.push({ url: req.url, auth: req.headers.authorization, body });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: `wamid.out.${++n}` }] }));
}).listen(3078);

// ---------- Helpers ----------
let wamid = 0;
async function webhook(payload, { firma = true, secreto = SECRET } = {}) {
  const raw = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (firma) headers['X-Hub-Signature-256'] = 'sha256=' + crypto.createHmac('sha256', secreto).update(raw).digest('hex');
  const r = await fetch(`${B}/api/whatsapp`, { method: 'POST', headers, body: raw });
  return r.status;
}
const aviso = (from, mensaje, { nombre = 'Cliente Prueba', phoneId = PHONE_ID, id } = {}) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '34600000000', phone_number_id: phoneId },
    contacts: [{ profile: { name: nombre }, wa_id: from }],
    messages: [{ from, id: id || `wamid.in.${++wamid}`, timestamp: String(Math.floor(Date.now() / 1000)), ...mensaje }]
  } }] }]
});
const texto = t => ({ type: 'text', text: { body: t } });
const boton = (id, title = id) => ({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title } } });
const fila = (id, title = id) => ({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id, title } } });

/** Sends a message as the customer and returns what the bot answered */
async function cliente(from, mensaje, opciones) {
  enviados = [];
  const s = await webhook(aviso(from, mensaje, opciones));
  return { s, r: enviados.map(e => e.body) };
}
const cuerpo = m => m.text?.body || m.interactive?.body?.text || '';
const ids = m => m.interactive?.action?.buttons?.map(b => b.reply.id) || m.interactive?.action?.sections?.[0]?.rows?.map(r => r.id) || [];

let cookie = '';
async function admin(p, { method = 'GET', body } = {}) {
  const h = { cookie };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(B + p, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie');
  if (sc?.startsWith('lagoa_admin=')) cookie = sc.split(';')[0];
  return { s: r.status, d: await r.json().catch(() => ({})) };
}

try {
  // ---------- Webhook verification (GET) ----------
  let r = await fetch(`${B}/api/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`);
  ok(r.status === 200 && (await r.text()) === '12345', 'verificación con el token correcto devuelve el challenge');
  r = await fetch(`${B}/api/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=12345`);
  ok(r.status === 403, 'verificación con token incorrecto → 403');

  // ---------- Signature ----------
  ok(await webhook(aviso('34611111111', texto('hola')), { firma: false }) === 401, 'aviso sin firma → 401');
  ok(await webhook(aviso('34611111111', texto('hola')), { secreto: 'falso' }) === 401, 'aviso con firma falsa → 401');
  ok(enviados.length === 0, 'con firma mala el bot no contesta nada');

  // ---------- First contact ----------
  const A = '34611111111';
  let c = await cliente(A, texto('Hola'), { id: 'wamid.repetido' });
  ok(c.s === 200 && c.r.length === 2, 'primer "Hola" → saludo + menú');
  ok(cuerpo(c.r[0]).includes('Cliente Prueba') && c.r[1].interactive?.type === 'list', 'saludo con su nombre de WhatsApp y menú en lista');
  ok(enviados[0].auth === 'Bearer token-de-prueba' && enviados[0].url === `/v23.0/${PHONE_ID}/messages`, 'llama a la API de Meta con el token y el Phone ID');
  c = await cliente(A, texto('Hola'), { id: 'wamid.repetido' });
  ok(c.r.length === 0, 'Meta repite el mismo mensaje → no se contesta dos veces');

  c = await cliente(A, texto('¿Cuánto cuesta una web?'));
  ok(c.r.length === 1 && cuerpo(c.r[0]).includes('290') && cuerpo(c.r[0]).includes('IVA'), 'pregunta de precio → tarifas con IVA');
  ok(ids(c.r[0]).join() === 'tema:reservar,tema:menu,tema:nadia', 'debajo, botones Reservar / Menú / Hablar con Nadia');
  c = await cliente(A, fila('tema:plazos', 'Plazos'));
  ok(cuerpo(c.r[0]).includes('semanas'), 'opción Plazos del menú → plazos');
  c = await cliente(A, texto('blablabla xyz'));
  ok(cuerpo(c.r[0]).includes('No estoy seguro'), 'texto que no entiende → ofrece menú o Nadia');
  c = await cliente(A, { type: 'audio', audio: { id: 'x' } });
  ok(cuerpo(c.r[0]).includes('solo puedo leer'), 'audio → explica que solo lee texto');
  c = await cliente('34699999999', texto('hola'), { phoneId: 'OTRO' });
  ok(c.r.length === 0, 'aviso para otro número de empresa → se ignora');

  // ---------- Booking ----------
  c = await cliente(A, boton('tema:reservar'));
  ok(ids(c.r[0]).join() === 'mod:0,mod:1,mod:2', 'Reservar → elegir modalidad (3 botones)');
  c = await cliente(A, boton('mod:0', 'Videollamada'));
  const dias = ids(c.r[0]);
  ok(dias.length > 0 && dias.length <= 10 && dias.every(d => /^dia:\d{4}-\d{2}-\d{2}$/.test(d)), `lista de días libres (${dias.length})`);
  ok(c.r[0].interactive.action.sections[0].rows.every(f => f.title.length <= 24), 'títulos de la lista ≤ 24 caracteres (límite de WhatsApp)');
  c = await cliente(A, texto('mañana'));
  ok(cuerpo(c.r[0]).includes('Elige') && ids(c.r[1]).length === dias.length, 'escribe en vez de elegir → se lo pide otra vez');
  const fecha = dias[0].slice(4);
  c = await cliente(A, fila(dias[0]));
  const horas = ids(c.r[0]);
  ok(horas.length >= 2 && horas.at(-1) === 'volver:dia', 'lista de horas de ese día + "Otro día"');
  const hora = horas[0].slice(5);
  c = await cliente(A, fila(horas[0]));
  ok(ids(c.r[0]).join() === 'nombre:perfil', 'pide el nombre con botón "Soy Cliente Prueba"');
  c = await cliente(A, boton('nombre:perfil'));
  ok(ids(c.r[0]).join() === 'negocio:no', 'pide el negocio (con Saltar)');
  c = await cliente(A, texto('Peluquería Sol'));
  ok(cuerpo(c.r[0]).includes('Peluquería Sol') && cuerpo(c.r[0]).includes('privacidad') && ids(c.r[0])[0] === 'ok', 'resumen con privacidad y botón Confirmar');
  c = await cliente(A, boton('ok', 'Confirmar'));
  ok(cuerpo(c.r[0]).includes('Listo'), 'Confirmar → cita guardada');
  let d = (await fetch(`${B}/api/disponibilidad`).then(x => x.json())).ocupados;
  ok(d.includes(`${fecha} ${hora}`), 'la hora reservada por WhatsApp ya sale ocupada en la web');

  // ---------- Admin: login and see it ----------
  ok((await admin('/api/admin/login', { method: 'POST', body: { password: PASSWORD } })).s === 200, 'login en el panel');
  let a = await admin(`/api/admin/citas?desde=${fecha}&hasta=${fecha}`);
  const cita = a.d.citas.find(x => x.hora === hora);
  ok(cita && cita.origen === 'whatsapp' && cita.telefono === '+' + A && cita.nombre === 'Cliente Prueba' && cita.estado === 'pendiente', 'la cita aparece en la agenda: origen whatsapp, pendiente');

  // ---------- Same slot from the web → taken ----------
  r = await fetch(`${B}/api/reservas`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha, hora, modalidad: 'Videollamada', nombre: 'Web', telefono: '622222222', privacidad: true }) });
  ok(r.status === 409, 'la web no puede reservar la misma hora → 409');

  // ---------- Booking a slot that gets taken meanwhile ----------
  const Bnum = '34622222222';
  await cliente(Bnum, boton('tema:reservar'));
  await cliente(Bnum, boton('mod:1'));
  c = await cliente(Bnum, fila(dias[0]));
  const horaB = ids(c.r[0])[0];
  await cliente(Bnum, fila(horaB));
  await cliente(Bnum, texto('Bea'));
  await cliente(Bnum, boton('negocio:no'));
  await admin('/api/admin/citas', { method: 'POST', body: { fecha, hora: horaB.slice(5), nombre: 'Ocupa', telefono: '633' } });
  c = await cliente(Bnum, boton('ok'));
  ok(cuerpo(c.r[0]).includes('ocupar') && c.r[1]?.interactive?.type === 'list', 'la hora se ocupa antes de confirmar → avisa y ofrece otras horas');

  // ---------- My bookings and cancel ----------
  c = await cliente(A, texto('mis citas'));
  ok(cuerpo(c.r[0]).includes(hora) && ids(c.r[0])[0] === `anular:${cita.id}`, 'Mis citas → muestra la cita con botón Cancelar');
  c = await cliente(A, boton(`anular:${cita.id}`));
  ok(ids(c.r[0])[0] === `anularok:${cita.id}`, 'pide confirmación antes de cancelar');
  c = await cliente('34644444444', boton(`anularok:${cita.id}`));
  a = await admin(`/api/admin/citas?desde=${fecha}&hasta=${fecha}`);
  ok(a.d.citas.find(x => x.id === cita.id).estado === 'pendiente', 'otro número NO puede cancelar esa cita');
  c = await cliente(A, boton(`anularok:${cita.id}`));
  a = await admin(`/api/admin/citas?desde=${fecha}&hasta=${fecha}`);
  ok(cuerpo(c.r[0]).includes('cancelada') && a.d.citas.find(x => x.id === cita.id).estado === 'cancelada', 'su dueño sí la cancela y la hora queda libre');

  // ---------- Limit of 2 bookings per phone ----------
  for (const [i, idDia] of [[0, dias[0]], [1, dias[1] || dias[0]]]) {
    await cliente(A, boton('tema:reservar'));
    await cliente(A, boton('mod:0'));
    c = await cliente(A, fila(idDia));
    await cliente(A, fila(ids(c.r[0])[i === 0 ? 1 : 0]));
    await cliente(A, boton('nombre:perfil'));
    await cliente(A, boton('negocio:no'));
    c = await cliente(A, boton('ok'));
  }
  c = await cliente(A, boton('tema:reservar'));
  ok(cuerpo(c.r[0]).includes('Ya tienes 2'), 'tercera reserva con el mismo número → no deja');

  // ---------- Cancel mid-flow ----------
  await cliente(Bnum, boton('tema:reservar'));
  c = await cliente(Bnum, texto('cancelar'));
  ok(cuerpo(c.r[0]).includes('no he guardado'), '"cancelar" a mitad de reserva → sale sin guardar');

  // ---------- Talk to Nadia (bot pauses) ----------
  c = await cliente(Bnum, boton('tema:nadia'));
  ok(cuerpo(c.r[0]).includes('He avisado a Nadia'), 'Hablar con Nadia → avisa y pausa el bot');
  c = await cliente(Bnum, texto('¿Me puedes hacer un descuento?'));
  ok(c.r.length === 0, 'con el bot en pausa, el bot no contesta');
  a = await admin('/api/admin/whatsapp');
  const chatB = a.d.chats.find(x => x.telefono === Bnum);
  ok(a.d.configurado && chatB.en_pausa && chatB.sin_leer > 0 && a.d.esperando === 1, 'el panel lo marca como "te espera"');
  a = await admin(`/api/admin/whatsapp?telefono=${Bnum}`);
  ok(a.d.mensajes.at(-1).texto.includes('descuento') && a.d.chat.ventana_abierta, 'el panel muestra la conversación completa');
  a = await admin('/api/admin/whatsapp');
  ok(a.d.chats.find(x => x.telefono === Bnum).sin_leer === 0, 'al abrirla se marca como leída');
  enviados = [];
  a = await admin('/api/admin/whatsapp', { method: 'POST', body: { telefono: Bnum, texto: 'Hola Bea, soy Nadia 🙂' } });
  ok(a.s === 201 && enviados[0]?.body.text.body === 'Hola Bea, soy Nadia 🙂', 'Nadia contesta desde el panel → sale por WhatsApp');
  a = await admin(`/api/admin/whatsapp?telefono=${Bnum}`);
  ok(a.d.mensajes.at(-1).autor === 'nadia', 'su respuesta queda en el historial como "nadia"');
  c = await cliente(Bnum, texto('menú'));
  ok(c.r[0]?.interactive?.type === 'list', 'el cliente escribe "menú" → el bot vuelve');
  await cliente(Bnum, boton('tema:nadia'));
  a = await admin('/api/admin/whatsapp', { method: 'PATCH', body: { telefono: Bnum, modo: 'bot' } });
  c = await cliente(Bnum, texto('precio'));
  ok(a.s === 200 && cuerpo(c.r[0]).includes('Tarifas'), 'Nadia devuelve el chat al bot desde el panel');

  // ---------- 24 h window ----------
  const pg = (await import('../web-profesional/node_modules/pg/lib/index.js')).default;
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54329/lagoa' });
  await db.connect();
  await db.query(`UPDATE wa_chats SET ultimo_entrante = now() - interval '25 hours' WHERE telefono = $1`, [Bnum]);
  a = await admin('/api/admin/whatsapp', { method: 'POST', body: { telefono: Bnum, texto: 'hola?' } });
  ok(a.s === 409, 'más de 24 h sin mensajes del cliente → el panel no deja escribir (regla de WhatsApp)');

  // ---------- Galician + stale flow ----------
  const G = '34655555555';
  c = await cliente(G, texto('Ola! Canto custa unha tenda?'), { nombre: 'Xiana' });
  ok(c.r.length === 2 && cuerpo(c.r[0]).startsWith('Ola, Xiana') && cuerpo(c.r[1]).includes('IVE'), 'cliente en gallego → contesta en gallego');
  c = await cliente(G, texto('castellano'));
  ok(c.r[0].interactive.action.button === 'Ver opciones', '"castellano" → cambia a castellano');
  await cliente(G, boton('tema:reservar'));
  await db.query(`UPDATE wa_chats SET actualizado = now() - interval '3 hours' WHERE telefono = $1`, [G]);
  c = await cliente(G, texto('precio'));
  ok(cuerpo(c.r[0]).includes('Tarifas'), 'reserva abandonada hace horas → se olvida y contesta normal');
  await db.end();

  // ---------- Admin API is private ----------
  const anon = await fetch(`${B}/api/admin/whatsapp`);
  ok(anon.status === 401, 'sin sesión no se pueden leer los chats → 401');
} catch (e) {
  fallos++;
  console.log('FAIL excepción: ' + e.stack);
} finally {
  graph.close();
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
}
