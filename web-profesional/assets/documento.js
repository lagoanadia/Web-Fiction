'use strict';
/* =============================================================
   Pinta una factura (o factura proforma) en una hoja A4.
   Lo usan /documento (pedidos reales) y la demo de la tienda.
   Solo crea nodos con textContent: los datos del cliente nunca
   se interpretan como HTML.

   Documento.render(contenedor, {
     titulo, codigo, fecha, estado?, marca? (por defecto LAGOA), emisor: { nombre, nif, direccion, email, iban },
     cliente: { nombre, negocio, nif, direccion, email, telefono },
     lineas: [{ concepto, cantidad, base, iva, total }]   ← céntimos
     base, iva, total, notas: [texto]
   })
   ============================================================= */
window.Documento = (function () {
  const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const money = c => eur.format(c / 100);
  const fecha = iso => iso ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z')) : '';
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function bloque(titulo, filas) {
    const b = el('div', 'doc__party');
    b.append(el('p', 'doc__label', titulo));
    filas.filter(Boolean).forEach((t, i) => b.append(el(i ? 'p' : 'strong', null, t)));
    return b;
  }
  function render(root, d) {
    const hoja = el('article', 'doc');
    const head = el('header', 'doc__head');
    const brand = el('div', 'doc__brand');
    brand.append(el('span', 'doc__mark'), el('span', null, d.marca || 'LAGOA'));
    const meta = el('div', 'doc__meta');
    meta.append(el('h1', null, d.titulo), el('p', null, d.codigo ? `Nº ${d.codigo}` : ''), el('p', null, fecha(d.fecha)));
    if (d.estado) meta.append(el('p', `doc__state doc__state--${d.estado.clase}`, d.estado.texto));
    head.append(brand, meta);

    const parts = el('section', 'doc__parties');
    const e = d.emisor || {}, c = d.cliente || {};
    parts.append(
      bloque('Emisor', [e.nombre, e.nif && `NIF ${e.nif}`, e.direccion, e.email]),
      bloque('Cliente', [c.nombre, c.negocio && c.negocio !== c.nombre ? c.negocio : '', c.nif && `NIF/CIF ${c.nif}`, c.direccion, c.email, c.telefono])
    );

    const tabla = el('table', 'doc__table');
    const thead = el('thead'); const trh = el('tr');
    ['Concepto', 'Cant.', 'Base', 'IVA 21 %', 'Total'].forEach(t => trh.append(el('th', null, t)));
    thead.append(trh);
    const tbody = el('tbody');
    (d.lineas || []).forEach(l => {
      const tr = el('tr');
      tr.append(el('td', null, l.concepto), el('td', null, String(l.cantidad || 1)), el('td', null, money(l.base)), el('td', null, money(l.iva)), el('td', null, money(l.total)));
      tbody.append(tr);
    });
    tabla.append(thead, tbody);

    const tot = el('dl', 'doc__totals');
    tot.append(el('dt', null, 'Base imponible'), el('dd', null, money(d.base)), el('dt', null, 'IVA (21 %)'), el('dd', null, money(d.iva)), el('dt', 'doc__grand', 'Total'), el('dd', 'doc__grand', money(d.total)));

    const notas = el('footer', 'doc__notes');
    (d.notas || []).filter(Boolean).forEach(t => notas.append(el('p', null, t)));

    hoja.append(head, parts, tabla, tot, notas);
    root.replaceChildren(hoja);
    return hoja;
  }
  return { render, money };
})();
