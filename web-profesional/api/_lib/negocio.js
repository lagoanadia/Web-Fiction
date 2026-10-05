/* =============================================================
   Datos del negocio que usa el bot de WhatsApp.
   ⚠ Los precios también están en index.html (const SERVICES y PACK):
   si cambias uno, cambia el otro.
   ============================================================= */
export const WEB = 'https://lagoa-webs.vercel.app';
export const PRIVACIDAD = `${WEB}/#privacidad`;

export const SERVICIOS = [
  { id: 'web', es: 'Web con galería y reservas', gl: 'Web con galería e reservas', precio: 290, mes: 15, plazo: { es: '3-4 semanas', gl: '3-4 semanas' } },
  { id: 'wa', es: 'Asistente de WhatsApp', gl: 'Asistente de WhatsApp', precio: 190, mes: 19, plazo: { es: '2-3 semanas', gl: '2-3 semanas' } },
  { id: 'shop', es: 'Tienda online pequeña', gl: 'Tenda online pequena', precio: 390, mes: 19, plazo: { es: '4-6 semanas', gl: '4-6 semanas' } },
  { id: 'seo', es: 'Google Maps y SEO local', gl: 'Google Maps e SEO local', precio: 120, mes: 0, plazo: { es: '1 semana', gl: '1 semana' } }
];
export const PACK = { es: 'Pack Web + WhatsApp', gl: 'Pack Web + WhatsApp', precio: 430, mes: 29, plazo: { es: '5-7 semanas', gl: '5-7 semanas' } };

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const eur = n => euros.format(n);
