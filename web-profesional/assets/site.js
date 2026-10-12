'use strict';
document.documentElement.classList.add('js');

/* =============================================================
   CONFIGURACIÓN — edita aquí tus datos sin tocar el resto
   ============================================================= */
const CONFIG = {
  whatsapp: '34613597453',             // formato internacional, sin + ni espacios
  email: 'nadialavi.work@gmail.com',   // donde llegan reservas y mensajes
  portfolio: 'https://nadia-lagoa.vercel.app',
  zona: 'Europe/Madrid',
  // Solo se usa si la API no responde (web estática): igual que api/_lib/horario.js
  horario: {
    1: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
    2: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
    3: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
    4: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
    5: ['16:00', '16:30', '17:00', '17:30', '18:00'],
    6: ['10:00', '10:30', '11:00', '11:30', '12:00']
  },
  diasVista: 14,
  antelacionHoras: 12
};
// Deben coincidir con MODALIDADES de api/_lib/citas.js
const MODALIDADES = ['Videollamada', 'Llamada de teléfono', 'En persona (solo A Coruña ciudad)'];

/* Precios FINALES con IVA. Una sola fuente para calculadora y asistente. */
const SERVICES = [
  { id: 'web', name: 'Web con galería y reservas', short: 'Web', price: 290, monthly: 15, weeks: '3-4 semanas' },
  { id: 'wa', name: 'Asistente de WhatsApp', short: 'WhatsApp', price: 190, monthly: 19, weeks: '2-3 semanas' },
  { id: 'shop', name: 'Tienda online pequeña', short: 'Tienda', price: 390, monthly: 19, weeks: '4-6 semanas' },
  { id: 'seo', name: 'Google Maps y SEO local', short: 'Google Maps', price: 120, monthly: 0, weeks: '1 semana' }
];
const PACK = { id: 'pack', name: 'Pack Web + WhatsApp', short: 'Pack', price: 430, monthly: 29, weeks: '5-7 semanas' };
const VAT = 0.21;
const svc = id => SERVICES.find(s => s.id === id);
const PACK_SAVING = svc('web').price + svc('wa').price - PACK.price;

/* ----------------------------- Utilidades ----------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const eurInt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurDec = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const eur = n => (Math.abs(n - Math.round(n)) < 0.005 ? eurInt : eurDec).format(n);
const waLink = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function el(tag, attrs = {}, text) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? (n.className = v) : n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } }
};
window.Lagoa = { $, $$, el, eur, store, waLink, reduceMotion };

/** Envía un formulario a tu email mediante FormSubmit. Devuelve true si ha ido bien. */
async function sendToEmail(subject, data) {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${CONFIG.email}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ _subject: subject, _template: 'table', _captcha: 'false', ...data })
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && String(json.success) === 'true';
  } catch {
    return false;
  }
}

/* --------------------------- Enlaces y pie --------------------------- */
$$('[data-wa]').forEach(a => { a.href = waLink(a.dataset.wa); a.target = '_blank'; a.rel = 'noopener'; });
$('#year').textContent = new Date().getFullYear();

/* ---------------------- Cambiar realidad (tema) ---------------------- */
(function theme() {
  const root = document.documentElement;
  const current = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('#theme-toggle').addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('lagoa-theme', next); } catch { /* */ }
  });
})();

/* ---------------------------- Hora local ----------------------------- */
(function clock() {
  const out = $('#clock');
  const fmt = new Intl.DateTimeFormat('es-ES', { timeZone: CONFIG.zona, hour: '2-digit', minute: '2-digit' });
  const tick = () => { out.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 15000);
})();

/* ---------------------- Barra superior y menú ------------------------ */
(function nav() {
  const top = $('.top');
  const btn = $('.top__menu');
  const sheet = $('#sheet');
  const update = () => { top.classList.toggle('is-solid', scrollY > 30); document.body.classList.toggle('past-hero', scrollY > innerHeight * 0.6); };
  addEventListener('scroll', update, { passive: true });
  update();
  const set = open => {
    top.dataset.open = String(open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    sheet.hidden = !open;
  };
  btn.addEventListener('click', () => set(sheet.hidden));
  $$('a', sheet).forEach(a => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) { set(false); btn.focus(); } });
})();

/* ------------------- Ventana (i): detalle bajo demanda ------------------- */
const Info = (function info() {
  const dlg = $('#info');
  let opener = null;
  function open(key, from) {
    const tpl = document.getElementById(`i-${key}`);
    if (!tpl) return;
    opener = from || document.activeElement;
    $('#info-kicker').textContent = tpl.dataset.kicker || '';
    $('#info-title').textContent = tpl.dataset.title || '';
    $('#info-body').replaceChildren(tpl.content.cloneNode(true));
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('[data-close]', dlg).focus();
  }
  function close() { dlg.close ? dlg.close() : dlg.removeAttribute('open'); }
  dlg.addEventListener('close', () => opener?.focus?.());
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-info]');
    if (b) { e.preventDefault(); open(b.dataset.info, b); }
    const p = e.target.closest('[data-open-privacy]');
    if (p) { e.preventDefault(); open('privacy', p); }
  });
  if (location.hash === '#privacidad') open('privacy');
  return { open };
})();

/* --------------- Portada: nudo de partículas (canvas 2D) ---------------
   Un nudo toroidal (2,3) hecho de puntos, que gira despacio y sigue
   un poco al ratón. Se pausa fuera de pantalla y con movimiento reducido. */
(function knot() {
  const cv = $('#knot');
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const N = innerWidth < 700 ? 1400 : 2600;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2;
    const a = Math.random() * Math.PI * 2;
    const rr = 0.075 * Math.sqrt(Math.random());
    pts.push({ t, a, rr, s: Math.random() });
  }
  let w = 0, h = 0, dpr = 1, rotX = -0.5, rotY = 0, mx = 0, my = 0, visible = true, raf = 0;
  const gap = { top: 0, bottom: 0 };
  function resize() {
    const box = cv.getBoundingClientRect();
    gap.top = $('.hero__cta').getBoundingClientRect().bottom - box.top;
    gap.bottom = $('.hero__foot').getBoundingClientRect().top - box.top;
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function color() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-ink').trim() || '#1f3dff';
  }
  let col = color();
  new MutationObserver(() => { col = color(); if (reduceMotion) draw(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function draw(time) {
    ctx.clearRect(0, 0, w, h);
    // En móvil el nudo va en el hueco libre entre el titular y los paneles
    let scale = Math.min(w, h) * 0.3, cx = w * 0.6, cy = h * 0.5;
    if (w < 760) { scale = Math.min(w * 0.36, (gap.bottom - gap.top) * 0.42); cx = w * 0.5; cy = (gap.top + gap.bottom) / 2; }
    rotY += 0.0022;
    const ry = rotY + mx * 0.4, rx = rotX + my * 0.3;
    const cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx);
    const k = time * 0.0003;
    ctx.fillStyle = col;
    for (const p of pts) {
      const t = p.t + k * (0.6 + p.s * 0.4);
      // nudo (2,3)
      const R = 0.62 + 0.28 * Math.cos(3 * t);
      let x = R * Math.cos(2 * t), y = R * Math.sin(2 * t), z = 0.28 * Math.sin(3 * t);
      // grosor del tubo
      x += p.rr * Math.cos(p.a + k); y += p.rr * Math.sin(p.a + k); z += p.rr * Math.cos(p.a * 1.7);
      // rotación
      let X = x * cyR + z * syR, Z = -x * syR + z * cyR;
      let Y = y * cxR - Z * sxR; Z = y * sxR + Z * cxR;
      const persp = 2.4 / (2.4 + Z);
      const sx = cx + X * scale * persp, sy = cy + Y * scale * persp;
      const size = (0.9 + p.s * 1.6) * persp;
      ctx.globalAlpha = Math.max(0.08, Math.min(1, 0.25 + (1 - Z) * 0.45));
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.globalAlpha = 1;
  }
  function loop(t) { draw(t); if (visible) raf = requestAnimationFrame(loop); }
  resize();
  addEventListener('resize', () => { resize(); if (reduceMotion) draw(0); });
  if (reduceMotion) { draw(0); return; }
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(loop);
  }).observe(cv);
})();

/* ------------- Pestañas Reservar / Mensaje (con flechas) -------------- */
const tabs = $$('.tabs [role=tab]');
function selectTab(tab) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next); next.focus();
  });
});

/* =============================================================
   AGENDA compartida por el formulario y el asistente.
   Usa la API real (/api/disponibilidad, /api/reservas); si no
   responde, usa el horario de CONFIG y la reserva va por email.
   Todas las horas son de A Coruña (Europe/Madrid), estés donde estés.
   ============================================================= */
const Agenda = (function agenda() {
  let horario = CONFIG.horario, diasVista = CONFIG.diasVista, antelacion = CONFIG.antelacionHoras;
  let ocupados = new Set();
  let conServidor = false;
  let loading = null;
  const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  /** milisegundos → "AAAA-MM-DD HH:MM" en hora de Madrid */
  const madridKey = ms => { const p = Object.fromEntries(keyFmt.formatToParts(new Date(ms)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; };
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weekday = iso => new Date(iso + 'T12:00:00Z').getUTCDay();

  function slots(iso) {
    const limite = madridKey(Date.now() + antelacion * 3600e3);
    return (horario[weekday(iso)] || []).filter(t => !ocupados.has(`${iso} ${t}`) && `${iso} ${t}` > limite);
  }
  function days() {
    const hoy = madridKey(Date.now()).slice(0, 10);
    const out = [];
    for (let i = 0; i <= diasVista; i++) { const f = addDays(hoy, i); const s = slots(f); if (s.length) out.push({ fecha: f, horas: s }); }
    return out;
  }
  function load() {
    loading = (async () => {
      try {
        const r = await fetch('/api/disponibilidad', { cache: 'no-store' });
        if (!r.ok) throw new Error('sin servidor');
        const d = await r.json();
        horario = d.horario; diasVista = d.diasVista; antelacion = d.antelacionHoras;
        ocupados = new Set(d.ocupados);
        conServidor = true;
      } catch { conServidor = false; }
    })();
    return loading;
  }
  /** Guarda una cita. Devuelve { estado: 'ok' | 'error', mensaje?, ocupada? } */
  async function reservar(d) {
    const when = `${fmtLong(d.fecha)} a las ${d.hora}`;
    const mail = { Tipo: 'Solicitud de consulta', Cuándo: when, Modalidad: d.modalidad, Nombre: d.nombre, Negocio: d.negocio || '—', Teléfono: d.telefono, Email: d.email || '—', Nota: d.nota || '—' };
    const subject = `Nueva reserva: ${d.nombre} · ${when}`;
    if (conServidor) {
      try {
        const r = await fetch('/api/reservas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, privacidad: true }) });
        if (r.ok) { sendToEmail(subject, mail); ocupados.add(`${d.fecha} ${d.hora}`); return { estado: 'ok', when }; }
        if ([400, 409, 429].includes(r.status)) {
          const j = await r.json().catch(() => ({}));
          if (r.status === 409) await load();
          return { estado: 'error', mensaje: j.error || 'No se ha podido reservar esa hora.', ocupada: r.status === 409 };
        }
      } catch { /* sin conexión: probamos por email */ }
    }
    const ok = await sendToEmail(subject, mail);
    return ok ? { estado: 'ok', when } : { estado: 'error', mensaje: 'No ha sido posible enviar la solicitud.', red: true, mail };
  }
  const fmtL = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const fmtS = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  function fmtLong(iso) { return fmtL.format(new Date(iso + 'T12:00:00Z')); }
  function fmtShort(iso) { return fmtS.format(new Date(iso + 'T12:00:00Z')).replace(/\./g, ''); }
  return { load, ready: () => loading, days, slots, reservar, fmtLong, fmtShort };
})();
Agenda.load();

/** Valida campos requeridos y marca el primero que falte */
function validate(form) {
  for (const input of $$('[required]', form)) {
    const empty = input.type === 'checkbox' ? !input.checked : !input.value.trim();
    const bad = (input.type === 'email' && input.value && !input.checkValidity()) || (input.type === 'tel' && input.value && !/^\+?[\d\s().-]{6,}$/.test(input.value));
    if (empty || bad) { input.focus(); input.setAttribute('aria-invalid', 'true'); return false; }
    input.removeAttribute('aria-invalid');
  }
  return true;
}
document.addEventListener('input', e => e.target.removeAttribute?.('aria-invalid'));

/** Error de envío: ofrece WhatsApp y email con el mismo texto */
function showFail(box, msg, summary) {
  box.hidden = false; box.dataset.type = 'error'; box.replaceChildren(el('p', {}, msg));
  if (!summary) return;
  const a = el('div', { class: 'actions' });
  a.append(
    el('a', { class: 'btn btn--wa btn--sm', href: waLink(summary), target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp'),
    el('a', { class: 'btn btn--ghost btn--sm', href: `mailto:${CONFIG.email}?subject=${encodeURIComponent('Contacto desde la web')}&body=${encodeURIComponent(summary)}` }, 'Enviar por email')
  );
  box.append(a);
}

/* ---------------------- RESERVA (formulario real) ---------------------- */
const Booking = (function booking() {
  const daysBox = $('#res-days');
  const slotsBox = $('#res-slots');
  const form = $('#form-reserva');
  const status = $('#res-status');
  const state = { fecha: null, hora: null };

  function renderDays() {
    daysBox.replaceChildren();
    const days = Agenda.days();
    if (!days.length) { daysBox.append(el('p', { class: 'muted small' }, 'No quedan horas libres estos días. Escríbeme por WhatsApp y buscamos hueco.')); return; }
    days.forEach(({ fecha }) => {
      const [wd, ...rest] = Agenda.fmtShort(fecha).replace(',', '').split(' ');
      const b = el('button', { type: 'button', class: 'choice', 'aria-pressed': String(state.fecha === fecha), 'aria-label': Agenda.fmtLong(fecha) });
      b.append(el('small', {}, wd), document.createTextNode(rest.join(' ')));
      b.addEventListener('click', () => { state.fecha = fecha; state.hora = null; $$('.choice', daysBox).forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderSlots(); });
      daysBox.append(b);
    });
  }
  function renderSlots() {
    slotsBox.replaceChildren();
    if (!state.fecha) { slotsBox.append(el('p', { class: 'muted small' }, 'Elige primero un día.')); return; }
    const libres = Agenda.slots(state.fecha);
    if (!libres.length) { slotsBox.append(el('p', { class: 'muted small' }, 'Ya no quedan horas este día. Elige otro.')); return; }
    libres.forEach(t => {
      const b = el('button', { type: 'button', class: 'choice', 'aria-pressed': String(state.hora === t) }, t);
      b.addEventListener('click', () => { state.hora = t; $$('.choice', slotsBox).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      slotsBox.append(b);
    });
  }
  function refresh() {
    if (state.fecha && !Agenda.slots(state.fecha).includes(state.hora)) state.hora = null;
    if (state.fecha && !Agenda.slots(state.fecha).length) state.fecha = null;
    renderDays(); renderSlots();
  }
  Agenda.ready().then(refresh);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.fecha || !state.hora) {
      status.hidden = false; status.dataset.type = 'error'; status.textContent = 'Elige un día y una hora.';
      (state.fecha ? slotsBox : daysBox).querySelector('button')?.focus();
      return;
    }
    if (!validate(form)) return;
    const f = new FormData(form);
    if (f.get('_honey')) return;
    const d = { fecha: state.fecha, hora: state.hora, modalidad: f.get('modalidad'), nombre: f.get('nombre').trim(), negocio: f.get('negocio').trim(), telefono: f.get('telefono').trim(), email: f.get('email').trim(), nota: f.get('nota').trim() };
    const btn = $('button[type=submit]', form);
    btn.disabled = true; btn.textContent = 'Enviando…';
    const r = await Agenda.reservar(d);
    btn.disabled = false; btn.textContent = 'Solicitar cita';
    if (r.estado === 'ok') {
      status.hidden = false; status.dataset.type = 'ok';
      status.textContent = `Hecho: ${r.when} (${d.modalidad}). Te confirmo por WhatsApp o email.`;
      form.reset(); state.fecha = state.hora = null; refresh();
      return;
    }
    const summary = r.red ? `Hola Nadia, quiero reservar una consulta.\n${Object.entries(r.mail).slice(1).map(([k, v]) => `${k}: ${v}`).join('\n')}` : '';
    showFail(status, r.red ? 'No se ha podido enviar. Puedes mandarlo así:' : r.mensaje, summary);
    if (r.ocupada) refresh();
  });
  return { refresh };
})();

/* --------------------------- MENSAJE --------------------------- */
(function contact() {
  const form = $('#form-mensaje');
  const status = $('#msg-status');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validate(form)) return;
    const f = new FormData(form);
    if (f.get('_honey')) return;
    const data = { Nombre: f.get('nombre'), Negocio: f.get('negocio') || '—', Email: f.get('email'), Teléfono: f.get('telefono') || '—', Servicio: f.get('servicio'), Mensaje: f.get('mensaje') };
    const summary = `Hola Nadia,\n${Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n')}`;
    const btn = $('button[type=submit]', form);
    btn.disabled = true; btn.textContent = 'Enviando…';
    const ok = await sendToEmail(`Nuevo mensaje: ${data.Nombre} · ${data.Servicio}`, { ...data, _replyto: data.Email });
    btn.disabled = false; btn.textContent = 'Enviar mensaje';
    if (ok) { status.hidden = false; status.dataset.type = 'ok'; status.textContent = 'Recibido. Te respondo en menos de 24 h laborables.'; form.reset(); }
    else showFail(status, 'No se ha podido enviar. Puedes mandarlo así:', summary);
  });
})();

/* ------------------------ CALCULADORA ------------------------ */
const Calc = (function calculator() {
  const box = $('#calc-options');
  const maint = $('#calc-maint');
  SERVICES.forEach(s => {
    const label = el('label', { class: 'calc-opt' });
    const input = el('input', { type: 'checkbox', value: s.id });
    const text = el('span');
    text.append(document.createTextNode(s.name), el('small', {}, s.weeks));
    label.append(input, text, el('b', {}, eur(s.price)));
    box.append(label);
  });
  let summaryText = '';

  function compute() {
    const ids = $$('input:checked', box).map(i => i.value);
    const chosen = ids.map(svc);
    const lines = ids.includes('web') && ids.includes('wa') ? [PACK, ...chosen.filter(s => s.id !== 'web' && s.id !== 'wa')] : chosen;
    const base = lines.reduce((a, s) => a + s.price, 0);
    const monthly = lines.reduce((a, s) => a + s.monthly, 0);
    const out = $('#calc-lines');
    out.replaceChildren();
    if (!lines.length) out.append(el('div', {}, 'Marca al menos un servicio (o pulsa “+ Presupuesto” en las tarjetas).'));
    lines.forEach(s => { const d = el('div'); d.append(el('span', {}, s.name + (s === PACK ? ` · ahorras ${eur(PACK_SAVING)}` : '')), el('span', {}, eur(s.price))); out.append(d); });
    $('#calc-total').textContent = eur(base);
    const showMonthly = maint.checked && monthly > 0;
    $('#calc-monthly').textContent = base ? `IVA incluido: ${eur(base - base / (1 + VAT))}${showMonthly ? ` · Mantenimiento ${eur(monthly)}/mes` : ''}` : '';
    $('#calc-time').textContent = lines.length ? `Plazo: ${lines.map(s => `${s.short} ${s.weeks}`).join(' · ')}` : '';
    summaryText = lines.length ? `Hola Nadia, me interesa este presupuesto:\n${lines.map(s => `• ${s.name}: ${eur(s.price)}`).join('\n')}\nTotal: ${eur(base)} (IVA incluido)${showMonthly ? `\nMantenimiento: ${eur(monthly)}/mes` : ''}` : '';
    $('#calc-send').disabled = !lines.length;
    const wa = $('#calc-wa');
    wa.href = lines.length ? waLink(summaryText) : `https://wa.me/${CONFIG.whatsapp}`;
    wa.target = '_blank'; wa.rel = 'noopener';
    wa.setAttribute('aria-disabled', String(!lines.length));
    // Sincroniza los botones "+ Presupuesto" de las tarjetas
    $$('[data-add]').forEach(b => { const on = ids.includes(b.dataset.add); b.setAttribute('aria-pressed', String(on)); b.closest('.card').classList.toggle('is-picked', on); });
  }
  function toggle(id, on) {
    const input = $(`input[value="${id}"]`, box);
    input.checked = on ?? !input.checked;
    compute();
  }
  box.addEventListener('change', compute);
  maint.addEventListener('change', compute);
  $('#calc-wa').addEventListener('click', e => { if (!summaryText) e.preventDefault(); });
  $$('[data-add]').forEach(b => b.addEventListener('click', () => toggle(b.dataset.add)));
  $('#calc-send').addEventListener('click', () => {
    selectTab($('#tab-mensaje'));
    $('#m-mensaje').value = summaryText;
    const chosen = $$('input:checked', box).map(i => i.value);
    const sel = $('#m-servicio');
    if (chosen.includes('web') && chosen.includes('wa')) sel.value = PACK.name;
    else if (chosen.length === 1) sel.value = svc(chosen[0]).name;
    $('#contacto').scrollIntoView();
    $('#m-nombre').focus({ preventScroll: true });
  });
  compute();
  return { toggle };
})();

/* --------------- Enlaces "Probar demo" de las tarjetas --------------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-demo]');
  if (a && window.Lab) window.Lab.open(a.dataset.demo);
});

/* --------------- Portfolio: se carga solo si lo pides --------------- */
$('#portfolio-load').addEventListener('click', () => {
  const view = $('#portfolio');
  const f = el('iframe', { src: CONFIG.portfolio, title: 'Portfolio de Nadia Lagoa Vilela', loading: 'lazy' });
  view.classList.add('is-loaded');
  view.replaceChildren(f);
  f.focus();
});

/* =============================================================
   ASISTENTE de la web
   Entiende preguntas por palabras clave (con puntuación, no "la
   primera que coincida"), responde en corto y RESERVA la consulta
   dentro del propio chat con la agenda real. Recuerda la
   conversación mientras la pestaña esté abierta.
   ============================================================= */
(function chatbot() {
  const panel = $('#chat'), openBtn = $('#chat-open'), log = $('#chat-log'), quick = $('#chat-quick'), input = $('#chat-input');
  const SAVE = 'lagoa-chat';
  let lang = 'es', busy = false, started = false;
  let flow = null; // reserva en marcha: { paso, datos }
  const history = [];
  let saved = [];
  try { const s = JSON.parse(sessionStorage.getItem(SAVE) || 'null'); if (s) saved = s.msgs || []; } catch { /* */ }
  const persist = () => { try { sessionStorage.setItem(SAVE, JSON.stringify({ lang, msgs: saved.slice(-40) })); } catch { /* */ } };

  const L = {
    es: {
      sub: 'responde al momento · también reserva',
      ph: 'Escribe tu pregunta', phName: 'Tu nombre', phTel: 'Tu teléfono o WhatsApp',
      hello: 'Hola 👋 Soy el asistente de Lagoa. Te digo precios y plazos en un segundo, y puedo reservarte la consulta gratis aquí mismo.',
      quick: [['precios', 'Precios'], ['reservar', 'Reservar consulta'], ['demo', 'Ver demos'], ['plazos', 'Plazos'], ['humano', 'Hablar con Nadia']],
      b: { info: 'Detalles', demo: 'Probar demo', calc: 'Calcular', book: 'Reservar aquí', wa: 'WhatsApp con Nadia', cancel: 'Cancelar', ok: 'Confirmar', other: 'Otro día', add: 'Añadir al presupuesto', go: 'Ir al formulario' },
      a: {
        precios: () => `Precio cerrado, IVA incluido:\n${SERVICES.map(s => `• ${s.short}: ${eur(s.price)}`).join('\n')}\n• Pack Web + WhatsApp: ${eur(PACK.price)} (ahorras ${eur(PACK_SAVING)})`,
        servicios: () => 'Hago 4 cosas: web con reservas, asistente de WhatsApp, tienda online y Google Maps. Y extras: IA para tu gestión diaria o algo a medida.',
        plazos: () => 'Google Maps 1 semana · WhatsApp 2-3 · Web 3-4 · Tienda 4-6 · Pack 5-7 semanas. Cuentan desde que tengo tus textos y fotos.',
        web: () => `Web con reservas: ${eur(svc('web').price)}. Tus clientes eligen servicio, día y hora; tú lo gestionas desde el móvil. La reserva de esta web es exactamente eso.`,
        wa: () => `Asistente de WhatsApp: ${eur(svc('wa').price)}. Responde al momento, apunta citas y te pasa la conversación si duda.`,
        shop: () => `Tienda online: ${eur(svc('shop').price)}. Catálogo, carrito, Bizum o tarjeta y aviso de cada pedido.`,
        seo: () => `Google Maps y SEO local: ${eur(svc('seo').price)}, en 1 semana. Ficha completa, fotos y reseñas respondidas.`,
        pack: () => `Pack Web + WhatsApp: ${eur(PACK.price)} en vez de 480 €. Comparten agenda: cero dobles reservas.`,
        ia: () => 'Gestión diaria con IA: 150 € + 35 €/mes. Cada día te propone recordatorios y respuestas; tú apruebas.',
        medida: () => 'También hago cosas a medida: stock, facturas, fidelización, apps… Se valora en la consulta gratis.',
        mantenimiento: () => `Mantenimiento opcional y cancelable: web ${eur(15)}, WhatsApp/tienda ${eur(19)}, pack ${eur(29)} al mes. Copias, seguridad y cambios pequeños ilimitados.`,
        iva: () => 'Todos los precios ya incluyen el IVA (21 %).',
        pago: () => 'Las condiciones de pago te las explica Nadia en persona. ¿Te paso con ella?',
        demo: () => 'Arriba tienes demos que funcionan: una tienda con carrito y panel de pedidos, un WhatsApp que reserva y una ficha de Google antes/después.',
        portfolio: () => 'Tienes sus proyectos publicados en la sección Portfolio.',
        zona: () => 'Trabaja sobre todo en A Coruña. Si estás en otra zona, escríbele y lo veis.',
        idiomas: () => 'Nadia te atiende en galego, castellano, English, Deutsch y français.',
        propiedad: () => 'Todo queda a tu nombre y te enseña a gestionarlo.',
        wordpress: () => 'Nada de WordPress ni plugins: código a medida, ligero y sin actualizaciones pendientes. Por eso esta web carga al instante.',
        hola: () => '¡Hola! ¿Qué quieres saber? Precios, plazos, demos… o reservo tu consulta.',
        gracias: () => '¡A ti! Si quieres, reservo tu consulta gratis en un momento.',
        humano: () => 'Claro. Pulsa y se abre WhatsApp con lo que hemos hablado.',
        fallback: () => 'Esa mejor te la responde Nadia. Te abro WhatsApp con tu pregunta ya escrita.'
      },
      f: {
        mod: 'Genial. La consulta es gratis (20 min). ¿Cómo la prefieres?',
        mods: ['Videollamada', 'Teléfono', 'En persona (A Coruña)'],
        day: '¿Qué día? (hora de España)',
        hour: d => `Horas libres el ${d}:`,
        none: 'Ahora mismo no quedan huecos. Escríbele a Nadia y buscáis uno.',
        name: '¿A nombre de quién?',
        tel: '¿Un teléfono o WhatsApp para confirmarte?',
        telBad: 'Ese teléfono no parece válido. Prueba otra vez (ej.: 600 123 456).',
        sum: d => `Revisa:\n📅 ${d.when}\n💬 ${d.modalidad}\n👤 ${d.nombre} · ${d.telefono}\n\nAl confirmar aceptas la política de privacidad.`,
        done: w => `¡Listo! Solicitud guardada para el ${w}. Nadia te confirma por WhatsApp o email.`,
        cancelled: 'Vale, no he guardado nada.',
        sending: 'Guardando…'
      }
    }
  };

  /* Palabras clave → tema. Gana el tema con más puntos (palabras largas pesan más). */
  const KEYS = {
    humano: ['hablar con', 'falar con', 'persona', 'persoa', 'humano', 'llamame', 'chamame', 'nadia'],
    reservar: ['reserv', 'cita', 'consulta', 'reunion', 'quedar', 'cafe', 'llamada', 'chamada', 'videollamada', 'hueco', 'oco'],
    precios: ['precio', 'prezo', 'cuesta', 'custa', 'cuanto', 'canto', 'vale', 'tarifa', 'coste', 'custo', 'euros', 'barato', 'caro'],
    plazos: ['plazo', 'prazo', 'tarda', 'semanas', 'tiempo', 'tempo', 'rapido'],
    servicios: ['servicio', 'servizo', 'que haces', 'que fas', 'ofreces', 'que vendes'],
    web: ['web', 'pagina', 'paxina', 'galeria', 'reservas online'],
    wa: ['whatsapp', 'chatbot', 'bot', 'asistente', 'mensajes'],
    shop: ['tienda', 'tenda', 'vender', 'carrito', 'carrino', 'ecommerce', 'pedido', 'bizum', 'productos'],
    seo: ['google', 'maps', 'seo', 'resena', 'recension', 'buscador', 'posicion', 'ficha'],
    pack: ['pack', 'paquete', 'combo', 'juntos', 'xuntos'],
    ia: [' ia', 'inteligencia', 'ai ', 'automatiz'],
    medida: ['a medida', 'personaliz', 'app', 'factura', 'stock', 'fideliz', 'crm'],
    mantenimiento: ['mantenimiento', 'mantemento', 'cuota', 'cota', 'mensual', 'al mes', 'ao mes', 'soporte', 'actualiz'],
    iva: ['iva', 'ive', 'impuesto', 'imposto'],
    pago: ['pagar', 'pago', 'pagamento', 'financ', 'plazos de pago', 'fraccion'],
    demo: ['demo', 'ejemplo', 'exemplo', 'probar', 'ver como', 'muestra'],
    portfolio: ['portfolio', 'trabajos', 'traballos', 'proyectos', 'proxectos', 'clientes'],
    zona: ['zona', 'donde', 'onde', 'coruna', 'ciudad', 'cidade', 'galicia', 'fuera'],
    idiomas: ['idioma', 'gallego', 'galego', 'ingles', 'english', 'aleman', 'frances'],
    propiedad: ['mio', 'meu', 'propiedad', 'propiedade', 'a mi nombre', 'ao meu nome', 'dueno', 'dono'],
    wordpress: ['wordpress', 'wix', 'plugin', 'plantilla', 'squarespace', 'shopify'],
    hola: ['hola', 'ola', 'buenas', 'boas', 'buenos dias', 'bos dias', 'hey'],
    gracias: ['gracias', 'grazas', 'genial', 'perfecto']
  };
  const norm = s => ` ${String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s]/g, ' ')} `;
  function topicFor(text) {
    const q = norm(text);
    let best = null, score = 0;
    for (const [topic, words] of Object.entries(KEYS)) {
      const s = words.reduce((a, w) => a + (q.includes(w) ? w.trim().length : 0), 0);
      if (s > score) { best = topic; score = s; }
    }
    // "¿cuánto cuesta la tienda?" → mejor la respuesta del servicio, que ya lleva el precio
    if (best === 'precios') {
      const s = ['shop', 'wa', 'seo', 'pack', 'ia', 'mantenimiento', 'web'].find(t => KEYS[t].some(w => q.includes(w)));
      if (s) return s;
    }
    return best || 'fallback';
  }

  /* -------- Pintar mensajes -------- */
  function bubble(who, text, actions) {
    const m = el('div', { class: `msg msg--${who}` });
    m.append(document.createTextNode(text));
    if (actions) m.append(actions);
    log.append(m);
    log.scrollTop = log.scrollHeight;
    saved.push([who, text]); persist();
    return m;
  }
  function buttons(list) {
    const box = el('div', { class: 'msg__actions' });
    list.forEach(([label, fn, cls]) => {
      if (typeof fn === 'string') { box.append(el('a', { class: cls || '', href: fn, target: '_blank', rel: 'noopener' }, label)); return; }
      const b = el('button', { type: 'button' }, label);
      b.addEventListener('click', () => { if (busy) return; $$('button', box).forEach(x => (x.disabled = true)); fn(label); });
      box.append(b);
    });
    return box;
  }
  function waBtn() {
    const text = ['Hola, Nadia. Te escribo desde tu web.', ...history.slice(-6).map(q => `— ${q}`)].join('\n');
    return [L[lang].b.wa, waLink(text), 'wa'];
  }
  function reply(fn) {
    busy = true;
    const typing = el('div', { class: 'typing', 'aria-label': '…' });
    typing.innerHTML = '<i></i><i></i><i></i>';
    log.append(typing); log.scrollTop = log.scrollHeight;
    setTimeout(async () => { await fn(); typing.remove(); busy = false; log.scrollTop = log.scrollHeight; }, reduceMotion ? 50 : 450);
  }
  const goTo = (sel, after) => { close(false); $(sel).scrollIntoView(); after?.(); };

  /* -------- Respuestas normales -------- */
  function answer(topic) {
    const T = L[lang];
    const acts = [];
    const svcInfo = { web: 'web', wa: 'wa', shop: 'shop', seo: 'seo', pack: 'pack', ia: 'ia', medida: 'medida', mantenimiento: 'maint' };
    const demo = { wa: 'wa', shop: 'shop', seo: 'maps' };
    if (topic === 'reservar') return startBooking();
    if (svcInfo[topic]) acts.push([T.b.info, () => Info.open(svcInfo[topic])]);
    if (demo[topic]) acts.push([T.b.demo, () => goTo('#demo', () => window.Lab?.open(demo[topic]))]);
    if (['web', 'wa', 'shop', 'seo'].includes(topic)) acts.push([T.b.add, () => { Calc.toggle(topic, true); bubble('bot', '✓'); }]);
    if (topic === 'demo') acts.push(['Tienda', () => goTo('#demo', () => window.Lab?.open('shop'))], ['WhatsApp', () => goTo('#demo', () => window.Lab?.open('wa'))], ['Google', () => goTo('#demo', () => window.Lab?.open('maps'))]);
    if (topic === 'precios' || topic === 'servicios') acts.push([T.b.calc, () => goTo('#presupuesto')]);
    if (topic === 'portfolio') acts.push(['Portfolio', () => goTo('#trabajos')]);
    if (['hola', 'gracias', 'precios', 'plazos', 'servicios', 'wordpress'].includes(topic)) acts.push([T.b.book, () => startBooking()]);
    if (['humano', 'fallback', 'pago', 'zona', 'medida'].includes(topic)) acts.push(waBtn());
    bubble('bot', T.a[topic](), acts.length ? buttons(acts) : null);
  }

  /* -------- Reserva dentro del chat -------- */
  async function startBooking() {
    const F = L[lang].f;
    flow = { paso: 'mod', datos: {} };
    bubble('bot', F.mod, buttons([
      ...F.mods.map((m, i) => [m, label => pick(label, () => { flow.datos.modalidad = MODALIDADES[i]; askDay(); })]),
      [L[lang].b.cancel, label => pick(label, cancelFlow)]
    ]));
  }
  function pick(label, next) { history.push(label); bubble('user', label); reply(next); }
  function cancelFlow() { flow = null; setPlaceholder(); bubble('bot', L[lang].f.cancelled); }
  async function askDay() {
    const F = L[lang].f;
    await Agenda.ready();
    const days = Agenda.days().slice(0, 8);
    if (!days.length) { flow = null; bubble('bot', F.none, buttons([waBtn()])); return; }
    flow.paso = 'day';
    bubble('bot', F.day, buttons([
      ...days.map(d => [Agenda.fmtShort(d.fecha), label => pick(label, () => { flow.datos.fecha = d.fecha; askHour(); })]),
      [L[lang].b.cancel, label => pick(label, cancelFlow)]
    ]));
  }
  function askHour() {
    const F = L[lang].f;
    const horas = Agenda.slots(flow.datos.fecha);
    if (!horas.length) return askDay();
    flow.paso = 'hour';
    bubble('bot', F.hour(Agenda.fmtLong(flow.datos.fecha)), buttons([
      ...horas.map(h => [h, label => pick(label, () => { flow.datos.hora = h; askName(); })]),
      [L[lang].b.other, label => pick(label, askDay)]
    ]));
  }
  function askName() { flow.paso = 'name'; setPlaceholder(); bubble('bot', L[lang].f.name); input.focus(); }
  function askTel() { flow.paso = 'tel'; setPlaceholder(); bubble('bot', L[lang].f.tel); input.focus(); }
  function summary() {
    const T = L[lang];
    flow.paso = 'confirm'; setPlaceholder();
    const d = flow.datos;
    bubble('bot', T.f.sum({ ...d, when: `${Agenda.fmtLong(d.fecha)}, ${d.hora}` }), buttons([
      [T.b.ok, label => pick(label, confirm)],
      [T.b.other, label => pick(label, askDay)],
      [T.b.cancel, label => pick(label, cancelFlow)]
    ]));
  }
  async function confirm() {
    const T = L[lang];
    const d = { ...flow.datos, negocio: '', email: '', nota: 'Reservada desde el asistente de la web' };
    const r = await Agenda.reservar(d);
    if (r.estado === 'ok') { flow = null; bubble('bot', T.f.done(r.when)); Booking.refresh(); return; }
    if (r.ocupada) { bubble('bot', r.mensaje); askDay(); return; }
    flow = null;
    bubble('bot', r.mensaje, buttons([waBtn(), [T.b.go, () => goTo('#contacto')]]));
  }
  function setPlaceholder() {
    const T = L[lang];
    input.placeholder = flow?.paso === 'name' ? T.phName : flow?.paso === 'tel' ? T.phTel : T.ph;
    input.type = flow?.paso === 'tel' ? 'tel' : 'text';
  }

  /* -------- Entrada de texto -------- */
  function ask(text, forced) {
    text = text.trim();
    if (busy || !text) return false;
    history.push(text);
    bubble('user', text);
    const t = forced || topicFor(text);
    // Durante una reserva: el nombre y el teléfono se escriben; "cancelar" sale
    if (flow && /\b(cancelar|salir|sair)\b/.test(norm(text))) { reply(cancelFlow); return true; }
    if (flow?.paso === 'name') { reply(() => { flow.datos.nombre = text.slice(0, 100); askTel(); }); return true; }
    if (flow?.paso === 'tel') {
      reply(() => { if (/^\+?[\d\s().-]{6,}$/.test(text)) { flow.datos.telefono = text.slice(0, 30); summary(); } else bubble('bot', L[lang].f.telBad); });
      return true;
    }
    if (flow) flow = null; // otra pregunta a mitad: se abandona la reserva
    setPlaceholder();
    reply(() => answer(t));
    return true;
  }

  function renderQuick() {
    quick.replaceChildren();
    L[lang].quick.forEach(([topic, label]) => {
      const b = el('button', { type: 'button' }, label);
      b.addEventListener('click', () => ask(label, topic));
      quick.append(b);
    });
  }
  function setLang(next, greet = true) {
    lang = next;
    $('#chat-sub').textContent = L[lang].sub;
    $('label[for="chat-input"]').textContent = L[lang].ph;
    setPlaceholder(); renderQuick(); persist();
    if (greet) { flow = null; bubble('bot', L[lang].hello); }
  }

  function open() {
    panel.hidden = false;
    openBtn.hidden = true;
    openBtn.setAttribute('aria-expanded', 'true');
    if (!started) {
      started = true;
      setLang(lang, false);
      if (saved.length) { const old = saved; saved = []; old.forEach(([w, t]) => bubble(w, t)); }
      else bubble('bot', L[lang].hello);
    }
    input.focus();
  }
  function close(focus = true) {
    panel.hidden = true;
    openBtn.hidden = false;
    openBtn.setAttribute('aria-expanded', 'false');
    if (focus) openBtn.focus();
  }
  openBtn.addEventListener('click', open);
  $('#chat-close').addEventListener('click', () => close());
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('#chat-form').addEventListener('submit', e => { e.preventDefault(); if (ask(input.value)) input.value = ''; });
  window.LagoaChat = { open, ask };
})();
