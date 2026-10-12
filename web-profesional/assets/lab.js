'use strict';
/* =============================================================
   DEMOS EN VIVO: tienda, WhatsApp y Google Maps.
   Negocios ficticios. Nada sale del navegador: el carrito y los
   pedidos de la demo se guardan solo en este dispositivo.
   ============================================================= */
(function lab() {
  const { $, $$, el, eur, store, reduceMotion } = window.Lagoa;

  /* ------------------------------ Pestañas ------------------------------ */
  const tabs = $$('.lab__tabs [role=tab]');
  const ids = { shop: 't-shop', wa: 't-wa', maps: 't-maps' };
  function select(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      select(tabs[(i + n + tabs.length) % tabs.length], true);
    });
  });
  window.Lab = { open(id) { const t = document.getElementById(ids[id]); if (t) select(t); } };

  /* =============================================================
     TIENDA · Forno do Cantón
     Catálogo con categorías, variantes y stock → carrito (se guarda)
     → datos → pago simulado → el pedido aparece en "Tu panel".
     ============================================================= */
  (function shop() {
    const SHIP = 3.5, FREE = 30;
    const pics = {
      pan: '<ellipse cx="50" cy="56" rx="38" ry="22" fill="#8a5a33"/><path d="M28 48 l8 10 M44 42 l8 12 M60 42 l8 12" stroke="#5e3a1e" stroke-width="3" stroke-linecap="round"/>',
      empanada: '<rect x="12" y="34" width="76" height="40" rx="8" fill="#d39a4a"/><path d="M12 40 Q20 34 28 40 T44 40 T60 40 T76 40 T88 40" stroke="#a96f2a" stroke-width="3" fill="none"/><path d="M30 54 h40" stroke="#a96f2a" stroke-width="3"/>',
      bica: '<rect x="14" y="38" width="72" height="32" rx="4" fill="#e3b56b"/><rect x="14" y="38" width="72" height="9" rx="4" fill="#f4e4c3"/>',
      millo: '<ellipse cx="50" cy="56" rx="34" ry="26" fill="#d9a63c"/><path d="M30 46 q20 -14 40 0" stroke="#a87a1d" stroke-width="3" fill="none"/>',
      tarta: '<circle cx="50" cy="56" r="34" fill="#e7c27c"/><path d="M50 36 v40 M36 46 l28 20 M64 46 l-28 20" stroke="#fff6e5" stroke-width="5" stroke-linecap="round"/>',
      rosquillas: '<circle cx="34" cy="48" r="14" fill="none" stroke="#e0b06a" stroke-width="10"/><circle cx="66" cy="48" r="14" fill="none" stroke="#e0b06a" stroke-width="10"/><circle cx="50" cy="70" r="14" fill="none" stroke="#e0b06a" stroke-width="10"/>',
      croissant: '<path d="M14 62 Q30 30 50 30 Q70 30 86 62 Q70 54 50 56 Q30 54 14 62z" fill="#d89a45"/><path d="M38 34 l6 22 M62 34 l-6 22 M50 30 v26" stroke="#a96f2a" stroke-width="3"/>',
      bolla: '<ellipse cx="50" cy="58" rx="36" ry="24" fill="#c98c4b"/><ellipse cx="50" cy="52" rx="26" ry="10" fill="#e4b77a"/>'
    };
    const PRODUCTS = [
      { id: 'centeno', cat: 'Pan', name: 'Pan de centeno', pic: 'pan', bg: '#efe2cf', variants: [['Pieza 500 g', 2.8]], stock: 12 },
      { id: 'millo', cat: 'Pan', name: 'Pan de millo', pic: 'millo', bg: '#f4e6c0', variants: [['Pieza 500 g', 3.2]], stock: 3 },
      { id: 'bolla', cat: 'Pan', name: 'Bolla de Cea', pic: 'bolla', bg: '#f1e2cc', variants: [['1 kg', 4.2], ['2 kg', 7.9]], stock: 8 },
      { id: 'empanada', cat: 'Salado', name: 'Empanada de zamburiñas', pic: 'empanada', bg: '#f3dfc2', variants: [['Media', 8], ['Entera', 14]], stock: 6 },
      { id: 'bica', cat: 'Dulce', name: 'Bica gallega', pic: 'bica', bg: '#f6ead3', variants: [['Pequeña', 6.5], ['Grande', 11]], stock: 7 },
      { id: 'santiago', cat: 'Dulce', name: 'Tarta de Santiago', pic: 'tarta', bg: '#efe0cb', variants: [['6 raciones', 12], ['10 raciones', 18]], stock: 4 },
      { id: 'rosquillas', cat: 'Dulce', name: 'Rosquillas de anís', pic: 'rosquillas', bg: '#f1e4d2', variants: [['6 u.', 4.5], ['12 u.', 8.5]], stock: 10 },
      { id: 'croissant', cat: 'Dulce', name: 'Croissant de manteiga', pic: 'croissant', bg: '#f5e7cf', variants: [['1 u.', 1.6], ['4 u.', 5.8]], stock: 0 }
    ];
    const K = { cart: 'lagoa-demo-cart', orders: 'lagoa-demo-orders', sold: 'lagoa-demo-sold' };
    let cart = store.get(K.cart, []);           // [{ id, v, qty }]
    let orders = store.get(K.orders, []);       // pedidos hechos en esta demo
    let sold = store.get(K.sold, {});           // unidades vendidas por producto (para el stock)
    let cat = 'Todo';
    let step = 'cart';
    const form = { delivery: 'pickup', name: '', tel: '', addr: '', slot: 'Mañana 9:00–11:00', pay: 'Bizum' };

    const grid = $('#shop-grid'), body = $('#shop-body'), drawer = $('#shop-drawer'), scrim = $('#shop-scrim');
    const openBtn = $('#shop-open'), count = $('#shop-count'), toastEl = $('#shop-toast');
    const P = id => PRODUCTS.find(p => p.id === id);
    const stockOf = p => Math.max(0, p.stock - (sold[p.id] || 0) - cart.filter(c => c.id === p.id).reduce((a, c) => a + c.qty, 0));
    const save = () => { store.set(K.cart, cart); store.set(K.orders, orders); store.set(K.sold, sold); };
    const units = () => cart.reduce((a, c) => a + c.qty, 0);
    const lineTotal = c => P(c.id).variants[c.v][1] * c.qty;
    const totals = () => {
      const sub = cart.reduce((a, c) => a + lineTotal(c), 0);
      const ship = form.delivery === 'ship' && sub > 0 && sub < FREE ? SHIP : 0;
      return { sub, ship, total: sub + ship };
    };
    let toastT;
    function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1500); }

    /* Filtros */
    const cats = ['Todo', ...new Set(PRODUCTS.map(p => p.cat))];
    const filters = $('#shop-filters');
    cats.forEach(c => {
      const b = el('button', { type: 'button', 'aria-pressed': String(c === cat) }, c);
      b.addEventListener('click', () => { cat = c; $$('button', filters).forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderGrid(); });
      filters.append(b);
    });

    /* Catálogo */
    function renderGrid() {
      grid.replaceChildren();
      PRODUCTS.filter(p => cat === 'Todo' || p.cat === cat).forEach(p => {
        const left = stockOf(p);
        const li = el('li', { class: 'prod' });
        const pic = el('div', { class: 'prod__pic', style: `background:${p.bg}` });
        pic.innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="${p.name}">${pics[p.pic]}</svg>`;
        if (!left) pic.append(el('span', { class: 'prod__badge' }, 'Agotado hoy'));
        else if (left <= 3) pic.append(el('span', { class: 'prod__badge prod__badge--low' }, `Quedan ${left}`));
        const b = el('div', { class: 'prod__body' });
        b.append(el('h4', {}, p.name));
        let sel = null;
        if (p.variants.length > 1) {
          sel = el('select', { 'aria-label': `Tamaño de ${p.name}` });
          p.variants.forEach(([n, pr], i) => sel.append(el('option', { value: i }, `${n} · ${eur(pr)}`)));
          b.append(sel);
        } else b.append(el('small', { style: 'color:var(--s-2);font-size:.75rem' }, p.variants[0][0]));
        const row = el('div', { class: 'prod__row' });
        const price = el('span', { class: 'prod__price' }, eur(p.variants[0][1]));
        sel?.addEventListener('change', () => { price.textContent = eur(p.variants[sel.value][1]); });
        const add = el('button', { type: 'button', class: 'prod__add', 'aria-label': `Añadir ${p.name}` }, left ? 'Añadir' : 'Agotado');
        add.disabled = !left;
        add.addEventListener('click', () => addToCart(p.id, sel ? Number(sel.value) : 0));
        row.append(price, add);
        b.append(row);
        li.append(pic, b);
        grid.append(li);
      });
    }
    function addToCart(id, v) {
      if (!stockOf(P(id))) { toast('No queda más stock hoy'); return; }
      const line = cart.find(c => c.id === id && c.v === v);
      line ? line.qty++ : cart.push({ id, v, qty: 1 });
      save(); update();
      toast(`${P(id).name} añadido`);
      count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
    }

    /* Carrito por pasos */
    function stepsBar(i) {
      const s = el('div', { class: 'steps-mini' });
      ['Carrito', 'Datos', 'Pago'].forEach((n, k) => s.append(el('span', { class: k <= i ? 'on' : '' }, n)));
      return s;
    }
    function render() {
      body.replaceChildren();
      if (step === 'cart') renderCart();
      else if (step === 'data') renderData();
      else if (step === 'pay') renderPay();
    }
    function renderCart() {
      body.append(stepsBar(0));
      if (!cart.length) {
        body.append(el('p', { style: 'color:var(--s-2)' }, 'Tu carrito está vacío. ¿Una empanada?'));
        const b = el('button', { type: 'button', class: 'sbtn sbtn--ghost' }, 'Seguir comprando');
        b.addEventListener('click', closeCart); body.append(b);
        return;
      }
      const list = el('div', { style: 'display:grid;gap:.6rem' });
      cart.forEach(c => {
        const p = P(c.id);
        const row = el('div', { class: 'line' });
        const name = el('div'); name.append(el('b', {}, p.name), el('br'), el('small', {}, p.variants[c.v][0]));
        const q = el('div', { class: 'qty' });
        const minus = el('button', { type: 'button', 'aria-label': `Quitar uno de ${p.name}` }, '−');
        const plus = el('button', { type: 'button', 'aria-label': `Añadir uno de ${p.name}` }, '+');
        minus.addEventListener('click', () => { c.qty--; if (!c.qty) cart = cart.filter(x => x !== c); save(); update(); });
        plus.addEventListener('click', () => { if (!stockOf(p)) { toast('No queda más stock hoy'); return; } c.qty++; save(); update(); });
        q.append(minus, el('span', {}, String(c.qty)), plus);
        row.append(name, el('b', {}, eur(lineTotal(c))), q);
        list.append(row);
      });
      body.append(list);
      const fs = el('fieldset');
      fs.append(el('legend', {}, 'Entrega'));
      [['pickup', 'Recoger en el obrador', 'gratis'], ['ship', 'Envío a domicilio', `${eur(SHIP)} · gratis desde ${eur(FREE)}`]].forEach(([v, t, s]) => {
        const l = el('label', { class: 'opt' });
        const i = el('input', { type: 'radio', name: 'shop-del', value: v });
        i.checked = form.delivery === v;
        i.addEventListener('change', () => { form.delivery = v; render(); });
        l.append(i, document.createTextNode(t), el('small', {}, s));
        fs.append(l);
      });
      body.append(fs);
      const t = totals();
      if (form.delivery === 'ship' && t.sub < FREE) {
        const f = el('div', { class: 'free' }, `Te faltan ${eur(FREE - t.sub)} para el envío gratis`);
        const bar = el('i'); bar.style.setProperty('--p', `${Math.min(100, t.sub / FREE * 100)}%`); f.append(bar); body.append(f);
      }
      body.append(totalsBox(t));
      const next = el('button', { type: 'button', class: 'sbtn' }, `Continuar · ${eur(t.total)}`);
      next.addEventListener('click', () => { step = 'data'; render(); $('input', body)?.focus(); });
      body.append(next);
    }
    function totalsBox(t) {
      const dl = el('dl', { class: 'totals' });
      dl.append(el('dt', {}, 'Subtotal'), el('dd', {}, eur(t.sub)), el('dt', {}, 'Entrega'), el('dd', {}, t.ship ? eur(t.ship) : 'Gratis'), el('dt', { class: 't' }, 'Total'), el('dd', { class: 't' }, eur(t.total)));
      return dl;
    }
    function field(label, key, type = 'text', ph = '') {
      const w = el('label', { style: 'display:grid;gap:.25rem;font-weight:600;font-size:.78rem' }, label);
      const i = el('input', { type, value: form[key], placeholder: ph, autocomplete: 'off' });
      i.addEventListener('input', () => { form[key] = i.value; i.removeAttribute('aria-invalid'); });
      w.append(i);
      return w;
    }
    function renderData() {
      body.append(stepsBar(1));
      body.append(field('Nombre', 'name', 'text', 'Ej.: Uxía'), field('Teléfono', 'tel', 'tel', '600 123 456'));
      if (form.delivery === 'ship') body.append(field('Dirección', 'addr', 'text', 'Rúa, número, piso'));
      else {
        const w = el('label', { style: 'display:grid;gap:.25rem;font-weight:600;font-size:.78rem' }, 'Hora de recogida');
        const s = el('select', { class: 's-select' });
        ['Mañana 9:00–11:00', 'Mañana 11:00–13:00', 'Mañana 17:00–20:00'].forEach(o => { const op = el('option', {}, o); op.selected = form.slot === o; s.append(op); });
        s.addEventListener('change', () => { form.slot = s.value; });
        w.append(s); body.append(w);
      }
      const err = el('p', { class: 'err', role: 'alert' });
      const row = el('div', { style: 'display:grid;grid-template-columns:auto 1fr;gap:.5rem' });
      const back = el('button', { type: 'button', class: 'sbtn sbtn--ghost', style: 'width:auto;padding-inline:1rem' }, '←');
      back.setAttribute('aria-label', 'Volver al carrito');
      back.addEventListener('click', () => { step = 'cart'; render(); });
      const next = el('button', { type: 'button', class: 'sbtn' }, 'Ir al pago');
      next.addEventListener('click', () => {
        const inputs = $$('input', body);
        const bad = [];
        if (form.name.trim().length < 2) bad.push(0);
        if (!/^\+?[\d\s().-]{9,}$/.test(form.tel)) bad.push(1);
        if (form.delivery === 'ship' && form.addr.trim().length < 5) bad.push(2);
        inputs.forEach((i, k) => i.toggleAttribute('aria-invalid', bad.includes(k)));
        if (bad.length) { err.textContent = 'Revisa los campos marcados.'; inputs[bad[0]].focus(); return; }
        step = 'pay'; render();
      });
      row.append(back, next);
      body.append(err, row, el('p', { class: 'sim' }, 'Demo: estos datos no se envían a ningún sitio.'));
    }
    function renderPay() {
      body.append(stepsBar(2));
      const t = totals();
      body.append(totalsBox(t));
      const fs = el('fieldset');
      fs.append(el('legend', {}, 'Pago'));
      [['Bizum', 'al instante'], ['Tarjeta', 'pasarela de tu banco']].forEach(([v, s]) => {
        const l = el('label', { class: 'opt' });
        const i = el('input', { type: 'radio', name: 'shop-pay', value: v });
        i.checked = form.pay === v;
        i.addEventListener('change', () => { form.pay = v; });
        l.append(i, document.createTextNode(v), el('small', {}, s));
        fs.append(l);
      });
      body.append(fs);
      const pay = el('button', { type: 'button', class: 'sbtn' }, `Pagar ${eur(t.total)}`);
      pay.addEventListener('click', checkout);
      const back = el('button', { type: 'button', class: 'sbtn sbtn--ghost' }, 'Volver');
      back.addEventListener('click', () => { step = 'data'; render(); });
      body.append(pay, back, el('p', { class: 'sim' }, 'Pago simulado: no se cobra nada.'));
      pay.focus();
    }
    function checkout() {
      const t = totals();
      body.replaceChildren(el('div', { class: 'spinner', 'aria-hidden': 'true' }), el('p', { class: 'sim', role: 'status' }, `Conectando con ${form.pay}…`));
      setTimeout(() => {
        const n = 142 + orders.length;
        const order = {
          n, total: t.total, pay: form.pay, name: form.name.trim(), state: 0, time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          how: form.delivery === 'ship' ? 'Envío' : `Recogida ${form.slot.replace('Mañana ', '')}`,
          items: cart.map(c => `${c.qty}× ${P(c.id).name}${P(c.id).variants.length > 1 ? ` (${P(c.id).variants[c.v][0]})` : ''}`)
        };
        cart.forEach(c => { sold[c.id] = (sold[c.id] || 0) + c.qty; });
        orders.unshift(order); cart = []; step = 'cart';
        save(); update(true);
        body.replaceChildren();
        const done = el('div', { class: 'done', role: 'status' });
        done.innerHTML = '<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="26" fill="#2f7d4f"/><path d="M17 29l7 7 15-16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        done.append(el('h5', {}, '¡Pedido recibido!'), el('p', {}, `Nº ${n} · ${eur(order.total)} con ${order.pay}`), el('p', { class: 'sim' }, `${order.how}. Te avisamos por WhatsApp cuando esté listo.`));
        const again = el('button', { type: 'button', class: 'sbtn' }, 'Seguir comprando');
        again.addEventListener('click', closeCart);
        done.append(again, el('p', { class: 'sim' }, '→ Mira “Tu panel”: el pedido ya te ha llegado.'));
        body.append(done);
        again.focus();
      }, reduceMotion ? 200 : 1300);
    }

    /* Panel del dueño */
    const STATES = ['Nuevo', 'Preparando', 'Listo'];
    function renderOrders(flashFirst) {
      const ol = $('#shop-orders');
      ol.replaceChildren();
      if (!orders.length) ol.append(el('li', { class: 'owner__empty' }, 'Haz un pedido en la tienda y aparecerá aquí al instante.'));
      orders.forEach((o, i) => {
        const li = el('li');
        const b = el('button', { type: 'button', class: `order${flashFirst && i === 0 ? ' is-new' : ''}`, 'aria-label': `Pedido ${o.n}, ${STATES[o.state]}. Pulsa para avanzar el estado` });
        b.append(el('b', {}, `#${o.n} · ${o.name} · ${eur(o.total)}`), el('span', { class: 'state', 'data-s': String(o.state) }, STATES[o.state]), el('small', {}, `${o.time} · ${o.pay} · ${o.how} — ${o.items.join(', ')}`));
        b.addEventListener('click', () => { o.state = (o.state + 1) % 3; save(); renderOrders(); });
        li.append(b); ol.append(li);
      });
      $('#kpi-orders').textContent = orders.length;
      $('#kpi-sales').textContent = eur(orders.reduce((a, o) => a + o.total, 0));
    }

    function update(newOrder) {
      const n = units();
      count.textContent = n;
      openBtn.setAttribute('aria-label', `Carrito, ${n} productos`);
      renderGrid();
      if (!drawer.hidden && step === 'cart') render();
      renderOrders(newOrder);
    }
    function openCart() { step = 'cart'; render(); drawer.hidden = false; scrim.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); $('#shop-close').focus(); }
    function closeCart() { drawer.hidden = true; scrim.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus(); }
    openBtn.addEventListener('click', openCart);
    $('#shop-close').addEventListener('click', closeCart);
    scrim.addEventListener('click', closeCart);
    drawer.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeCart(); } });
    $('#shop-reset').addEventListener('click', () => { cart = []; orders = []; sold = {}; save(); update(); toast('Demo reiniciada'); });
    update();
  })();

  /* =============================================================
     WHATSAPP · Peluquería Mar de Fondo
     Pequeña máquina de estados: servicio → hueco → confirmado.
     La cita aparece en "Tu agenda", y se puede cambiar o anular.
     ============================================================= */
  (function whatsapp() {
    const logEl = $('#wa-log'), quick = $('#wa-quick'), input = $('#wa-input');
    const fmtDay = { es: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' }), gl: new Intl.DateTimeFormat('gl-ES', { weekday: 'long', day: 'numeric' }) };
    const T = {
      es: {
        sys: 'Mensajes automáticos de Mar de Fondo · ejemplo',
        hello: '¡Hola! 👋 Soy el asistente de Mar de Fondo. Te digo horario y precios o te busco cita al momento.',
        quick: [['cita', 'Quiero cita'], ['precios', 'Precios'], ['horario', 'Horario'], ['cambiar', 'Cambiar mi cita'], ['perro', '¿Puedo ir con mi perro?']],
        horario: 'Martes a viernes 9:30–19:30 · Sábados 9:00–14:00. Domingo y lunes, cerrado.',
        precios: 'Corte mujer 22 € · Corte hombre 14 € · Peinado 15 € · Color desde 35 €. ¿Te busco hueco?',
        which: '¡Genial! ¿Qué te hacemos?',
        services: ['Corte mujer', 'Corte hombre', 'Peinado', 'Color'],
        slots: s => `Para ${s.toLowerCase()} tengo libre:`,
        ok: (s, h) => `Reservado ✅ ${s}, ${h}.\nTe mando un recordatorio el día antes. Si no puedes venir, escribe «cambiar».`,
        none: 'No tienes ninguna cita conmigo ahora mismo. ¿Te busco una?',
        mine: (s, h) => `Tienes: ${s}, ${h}. ¿Qué hacemos?`,
        cancel: 'Anular', move: 'Otra hora', keep: 'Dejarla',
        cancelled: 'Hecho, cita anulada y el hueco queda libre. ¡Hasta pronto!',
        kept: 'Perfecto, te esperamos 🙂',
        hand: 'Esa no la sé con seguridad 🤔 Te paso con una persona del equipo: te responde por aquí en cuanto pueda.',
        hola: '¡Hola! ¿Cita, precios u horario?',
        gracias: '¡A ti! 🌙',
        ph: 'Escribe como un cliente…'
      },
      gl: {
        sys: 'Mensaxes automáticas de Mar de Fondo · exemplo',
        hello: 'Ola! 👋 Son o asistente de Mar de Fondo. Dígoche horario e prezos ou búscoche cita ao momento.',
        quick: [['cita', 'Quero cita'], ['precios', 'Prezos'], ['horario', 'Horario'], ['cambiar', 'Cambiar a miña cita'], ['perro', 'Podo ir co meu can?']],
        horario: 'Martes a venres 9:30–19:30 · Sábados 9:00–14:00. Domingo e luns, pechado.',
        precios: 'Corte muller 22 € · Corte home 14 € · Peiteado 15 € · Cor desde 35 €. Búscoche oco?',
        which: 'Xenial! Que che facemos?',
        services: ['Corte muller', 'Corte home', 'Peiteado', 'Cor'],
        slots: s => `Para ${s.toLowerCase()} teño libre:`,
        ok: (s, h) => `Reservado ✅ ${s}, ${h}.\nMándoche un recordatorio o día antes. Se non podes vir, escribe «cambiar».`,
        none: 'Non tes ningunha cita agora mesmo. Búscoche unha?',
        mine: (s, h) => `Tes: ${s}, ${h}. Que facemos?`,
        cancel: 'Anular', move: 'Outra hora', keep: 'Deixala',
        cancelled: 'Feito, cita anulada e o oco queda libre. Ata pronto!',
        kept: 'Perfecto, esperámoste 🙂',
        hand: 'Esa non a sei con seguridade 🤔 Pásote cunha persoa do equipo: respóndeche por aquí en canto poida.',
        hola: 'Ola! Cita, prezos ou horario?',
        gracias: 'Grazas a ti! 🌙',
        ph: 'Escribe como un cliente…'
      }
    };
    const KEYS = [
      ['cambiar', ['cambiar', 'anular', 'cancelar', 'mi cita', 'mina cita']],
      ['cita', ['cita', 'reserv', 'hueco', 'oco', 'turno', 'quiero', 'quero']],
      ['precios', ['precio', 'prezo', 'cuanto', 'canto', 'cuesta', 'custa', 'vale']],
      ['horario', ['horario', 'abr', 'cerr', 'pech', 'hora']],
      ['hola', ['hola', 'ola', 'buenas', 'boas']],
      ['gracias', ['gracias', 'grazas']]
    ];
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n');
    let lang = 'es', busy = false, mine = null;
    // Agenda de ejemplo: ya hay citas de la web y del chat
    const seed = () => {
      const d = nextOpenDays(2);
      return [
        { who: 'Antía R.', what: 'Color', when: `${fmt(d[0])}, 10:00`, at: at(d[0], '10:00'), src: 'web' },
        { who: 'Manuel P.', what: 'Corte hombre', when: `${fmt(d[1])}, 17:30`, at: at(d[1], '17:30'), src: 'WhatsApp' }
      ];
    };
    let agenda = [];
    function nextOpenDays(n) {
      const out = []; const d = new Date(); d.setHours(12, 0, 0, 0);
      while (out.length < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w >= 2 && w <= 6) out.push(new Date(d)); }
      return out;
    }
    function at(d, h) { const x = new Date(d); const [hh, mm] = h.split(':'); x.setHours(+hh, +mm, 0, 0); return x.getTime(); }
    function fmt(d) { const s = fmtDay[lang].format(d); return s.charAt(0).toUpperCase() + s.slice(1); }
    function freeSlots() {
      const days = nextOpenDays(3);
      const hours = [['10:30', '12:00'], ['17:00', '18:30'], ['11:00']];
      const all = days.flatMap((d, i) => (d.getDay() === 6 ? ['10:00', '11:30'] : hours[i]).map(h => ({ when: `${fmt(d)}, ${h}`, at: at(d, h) })));
      return all.filter(s => !agenda.some(a => a.at === s.at)).slice(0, 4);
    }
    const now = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    function msg(dir, text, opts = []) {
      const m = el('div', { class: `wb wb--${dir}${opts.hand ? ' wb--hand' : ''}` });
      m.append(document.createTextNode(text));
      if (opts.buttons) {
        const box = el('div', { class: 'wb__opts' });
        opts.buttons.forEach(([label, fn]) => {
          const b = el('button', { type: 'button' }, label);
          b.addEventListener('click', () => { if (busy) return; $$('button', box).forEach(x => (x.disabled = true)); say(label, fn); });
          box.append(b);
        });
        m.append(box);
      }
      m.append(el('time', {}, now() + (dir === 'out' ? ' ✓✓' : '')));
      logEl.append(m);
      logEl.scrollTop = logEl.scrollHeight;
    }
    function say(text, fn) {
      busy = true;
      msg('out', text);
      const t = el('div', { class: 'typing', 'aria-label': 'escribiendo' });
      t.innerHTML = '<i></i><i></i><i></i>';
      logEl.append(t); logEl.scrollTop = logEl.scrollHeight;
      setTimeout(() => { t.remove(); fn(); busy = false; }, reduceMotion ? 60 : 700);
    }
    const L = () => T[lang];
    const act = {
      horario: () => msg('in', L().horario),
      precios: () => msg('in', L().precios, { buttons: [[L().quick[0][1], act.cita]] }),
      hola: () => msg('in', L().hola),
      gracias: () => msg('in', L().gracias),
      perro: () => msg('in', L().hand, { hand: true }),
      cita: () => msg('in', L().which, { buttons: L().services.map(s => [s, () => act.slots(s)]) }),
      slots: s => {
        const free = freeSlots();
        msg('in', L().slots(s), { buttons: free.map(h => [h.when, () => act.book(s, h)]) });
      },
      book: (s, h) => {
        if (mine) agenda = agenda.filter(a => a !== mine);
        mine = { who: lang === 'gl' ? 'Ti (cliente)' : 'Tú (cliente)', what: s, when: h.when, at: h.at, src: 'WhatsApp', fresh: true };
        agenda.push(mine);
        renderAgenda();
        msg('in', L().ok(s, h.when));
      },
      cambiar: () => {
        if (!mine) return msg('in', L().none, { buttons: [[L().quick[0][1], act.cita]] });
        msg('in', L().mine(mine.what, mine.when), { buttons: [
          [L().move, () => act.slots(mine.what)],
          [L().cancel, () => { agenda = agenda.filter(a => a !== mine); mine = null; renderAgenda(); msg('in', L().cancelled); }],
          [L().keep, () => msg('in', L().kept)]
        ] });
      }
    };
    function topic(text) {
      const q = norm(text);
      if (/perro|can\b|mascota/.test(q)) return 'perro';
      const hit = KEYS.find(([, w]) => w.some(x => q.includes(x)));
      return hit ? hit[0] : 'perro'; // lo que no sabe → pasa a una persona
    }
    function renderAgenda() {
      const ol = $('#wa-agenda');
      ol.replaceChildren();
      agenda.sort((x, y) => x.at - y.at).forEach(a => {
        const li = el('li');
        const d = el('div', { class: `order${a.fresh ? ' is-new' : ''}`, style: 'cursor:default' });
        d.append(el('b', {}, `${a.when} · ${a.what}`), el('span', { class: 'state', 'data-s': a.src === 'web' ? '2' : '0' }, a.src), el('small', {}, a.who));
        li.append(d); ol.append(li);
        a.fresh = false;
      });
    }
    function render() {
      logEl.replaceChildren(el('div', { class: 'wa-sys' }, L().sys));
      input.placeholder = L().ph;
      quick.replaceChildren();
      L().quick.forEach(([k, label]) => {
        const b = el('button', { type: 'button' }, label);
        b.addEventListener('click', () => { if (!busy) say(label, act[k]); });
        quick.append(b);
      });
      msg('in', L().hello);
    }
    function reset() { mine = null; agenda = seed(); renderAgenda(); render(); }
    $('#wa-form').addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || busy) return;
      input.value = '';
      say(text, act[topic(text)]);
    });
    $$('[data-walang]').forEach(b => b.addEventListener('click', () => {
      if (busy || b.dataset.walang === lang) return;
      lang = b.dataset.walang;
      $$('[data-walang]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      reset();
    }));
    $('#wa-reset').addEventListener('click', reset);
    reset();
  })();

  /* =============================================================
     GOOGLE MAPS · Frutería A Horta: antes / después
     ============================================================= */
  (function maps() {
    const gm = $('#gm');
    const DATA = {
      before: {
        cat: 'Tienda', reviews: '(3 · sin responder)', pos: '7.º',
        photos: [['Borrosa', '#9aa0a6'], ['', '#dadce0'], ['', '#e8eaed'], ['', '#f1f3f4']],
        rows: [['bad', '🕒 Horario sin añadir'], ['bad', '📝 Sin descripción'], ['', '📍 Rúa Exemplo, 3 · A Coruña'], ['bad', '💬 3 reseñas sin respuesta']]
      },
      after: {
        cat: 'Frutería · Verdura de temporada · Reparto', reviews: '(3 · todas respondidas)', pos: '2.º',
        photos: [['Fachada', '#c96f2c'], ['Fruta', '#d0492f'], ['Verdura', '#4f8a3a'], ['Equipo', '#5e5a7a']],
        rows: [['good', '🕒 Abierto · cierra a las 14:00'], ['good', '📝 Frutería de barrio con fruta fresca y reparto a domicilio'], ['', '📍 Rúa Exemplo, 3 · A Coruña'], ['good', '💬 “Moitas grazas, Antía…” — respuesta del propietario']]
      }
    };
    const CHECKS = ['Categoría correcta', 'Horario completo', 'Descripción con palabras clave', 'Fotos que venden', 'Reseñas respondidas'];
    const OTHERS = [['Supermercado O Porto', '4,1 ★ · 800 m'], ['Froitas Marola', '4,4 ★ · 1,2 km'], ['Mercado Barrio Alto', '4,3 ★ · 1,5 km'], ['Ultramarinos Pedra', '4,0 ★ · 900 m'], ['Hortas do Val', '4,5 ★ · 2,3 km'], ['Tenda Rosalía', '3,9 ★ · 1,1 km']];
    function render(mode) {
      const d = DATA[mode];
      gm.dataset.mode = mode;
      $('.gm__rate b', gm).textContent = '4,1';
      $('#gm-cat').textContent = d.cat;
      $('#gm-reviews').textContent = d.reviews;
      $('#gm-photos').replaceChildren(...d.photos.map(([t, c]) => el('span', { style: `background:${c}` }, t)));
      $('#gm-rows').replaceChildren(...d.rows.map(([c, t]) => el('li', { class: c }, t)));
      const list = OTHERS.slice();
      list.splice(mode === 'after' ? 1 : 6, 0, ['Frutería A Horta', mode === 'after' ? '4,1 ★ · 300 m · Abierto' : '4,1 ★ · 300 m · horario desconocido', true]);
      $('#gm-results').replaceChildren(...list.map(([n, i, us]) => { const li = el('li', { class: us ? 'us' : '' }); const div = el('div'); div.append(document.createTextNode(n), el('small', {}, i)); li.append(div); return li; }));
      $('#gm-checks').replaceChildren(...CHECKS.map(c => el('li', { class: mode === 'after' ? 'on' : '' }, c)));
      $('#gm-pos').textContent = d.pos;
    }
    $$('[data-gm]').forEach(b => b.addEventListener('click', () => {
      $$('[data-gm]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      render(b.dataset.gm);
    }));
    render('before');
  })();
})();
