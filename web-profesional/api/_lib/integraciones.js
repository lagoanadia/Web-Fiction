/* =============================================================
   Conexión con otras herramientas (sin panel propio obligatorio)
   Cada cosa que pasa en la web —cita, mensaje, pedido, pago— se
   envía a los destinos que configures en Vercel:

   1. WEBHOOK (Make, Zapier, n8n…) → de ahí a Google Sheets, HubSpot,
      Airtable, Trello, Slack, Gmail o lo que quieras, sin programar.
        INTEGRACION_WEBHOOK_URL   una o varias URLs separadas por comas
        INTEGRACION_SECRETO       (opcional) firma cada envío: cabecera
                                  X-Lagoa-Firma: sha256=<HMAC del cuerpo>
   2. NOTION → una fila por evento en una base de datos.
        NOTION_TOKEN              token de una integración interna de Notion
        NOTION_DATABASE_ID        id de la base de datos (compartida con esa integración)
      Solo se rellenan las columnas que existan en tu base de datos
      (ver nombres abajo), así que puedes crearla a tu gusto.

   Nunca rompe la web: si un destino falla o tarda, se registra el
   error y la reserva / el mensaje / el pedido quedan guardados igual.
   ============================================================= */
import crypto from 'node:crypto';

const TIEMPO_MAX = 4000; // ms por destino
const TITULOS = {
  'cita.nueva': 'Cita nueva', 'cita.estado': 'Cita actualizada', 'mensaje.nuevo': 'Mensaje nuevo',
  'pedido.nuevo': 'Pedido nuevo', 'pedido.estado': 'Pedido actualizado',
  'whatsapp.atencion': 'WhatsApp: quiere hablar contigo'
};

const conTiempo = (promesa, ms) => Promise.race([promesa, new Promise((_, no) => setTimeout(() => no(new Error('tiempo agotado')), ms))]);

/**
 * Envía un evento a todos los destinos configurados.
 * datos: { nombre, email, telefono, negocio, detalle, fecha, hora, importe, estado, enlace, ... }
 */
export async function notificar(evento, datos) {
  const tareas = [];
  const urls = (process.env.INTEGRACION_WEBHOOK_URL || '').split(',').map(u => u.trim()).filter(u => /^https:\/\//.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)); // http solo en local (tests)
  if (urls.length) tareas.push(...urls.map(u => webhook(u, evento, datos)));
  if (process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID) tareas.push(notion(evento, datos));
  if (!tareas.length) return;
  const r = await Promise.allSettled(tareas.map(t => conTiempo(t, TIEMPO_MAX)));
  r.filter(x => x.status === 'rejected').forEach(x => console.error(`Integración (${evento}):`, x.reason?.message));
}

async function webhook(url, evento, datos) {
  const cuerpo = JSON.stringify({ evento, titulo: TITULOS[evento] || evento, fecha: new Date().toISOString(), datos });
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Lagoa-Web' };
  if (process.env.INTEGRACION_SECRETO) {
    headers['X-Lagoa-Firma'] = 'sha256=' + crypto.createHmac('sha256', process.env.INTEGRACION_SECRETO).update(cuerpo).digest('hex');
  }
  const r = await fetch(url, { method: 'POST', headers, body: cuerpo });
  if (!r.ok) throw new Error(`webhook ${r.status}`);
}

/* ---------------- Notion ----------------
   Columnas que se rellenan si existen (con ese nombre y tipo):
     (título, cualquier nombre) ← "Cita nueva · Nombre"
     Tipo (select) · Estado (select) · Nombre (texto) · Email (email)
     Teléfono (teléfono) · Negocio (texto) · Fecha (fecha)
     Importe (número) · Detalle (texto) · Enlace (URL)              */
const NOTION = process.env.NOTION_API_URL || 'https://api.notion.com/v1'; // la variable solo sirve para los tests
const cabecerasNotion = () => ({ Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' });
let esquema = null; // columnas de la base de datos (se lee una vez por instancia)

async function columnasNotion() {
  if (esquema) return esquema;
  const r = await fetch(`${NOTION}/databases/${process.env.NOTION_DATABASE_ID}`, { headers: cabecerasNotion() });
  if (!r.ok) throw new Error(`Notion ${r.status}: comparte la base de datos con tu integración`);
  const db = await r.json();
  esquema = Object.fromEntries(Object.entries(db.properties).map(([nombre, p]) => [nombre, p.type]));
  return esquema;
}

const textoNotion = t => [{ type: 'text', text: { content: String(t).slice(0, 1900) } }];

export async function notion(evento, d) {
  const cols = await columnasNotion();
  const titulo = Object.keys(cols).find(k => cols[k] === 'title');
  const props = {};
  if (titulo) props[titulo] = { title: textoNotion(`${TITULOS[evento] || evento} · ${d.nombre || ''}`.trim()) };
  const poner = (nombre, tipo, valor) => {
    if (valor === undefined || valor === null || valor === '' || cols[nombre] !== tipo) return;
    if (tipo === 'select') props[nombre] = { select: { name: String(valor).slice(0, 90).replace(/,/g, ' ') } };
    if (tipo === 'rich_text') props[nombre] = { rich_text: textoNotion(valor) };
    if (tipo === 'email') props[nombre] = { email: String(valor) };
    if (tipo === 'phone_number') props[nombre] = { phone_number: String(valor) };
    if (tipo === 'number') props[nombre] = { number: Number(valor) };
    if (tipo === 'url') props[nombre] = { url: String(valor) };
    if (tipo === 'date') props[nombre] = { date: { start: String(valor) } };
  };
  poner('Tipo', 'select', TITULOS[evento] || evento);
  poner('Estado', 'select', d.estado);
  poner('Nombre', 'rich_text', d.nombre);
  poner('Email', 'email', d.email);
  poner('Teléfono', 'phone_number', d.telefono);
  poner('Negocio', 'rich_text', d.negocio);
  poner('Fecha', 'date', d.fecha ? (d.hora ? `${d.fecha}T${d.hora}:00` : d.fecha) : new Date().toISOString().slice(0, 10));
  poner('Importe', 'number', d.importe);
  poner('Detalle', 'rich_text', d.detalle);
  poner('Enlace', 'url', d.enlace);
  const r = await fetch(`${NOTION}/pages`, { method: 'POST', headers: cabecerasNotion(), body: JSON.stringify({ parent: { database_id: process.env.NOTION_DATABASE_ID }, properties: props }) });
  if (!r.ok) { esquema = null; throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`); }
}
