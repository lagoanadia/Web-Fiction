/* =============================================================
   Datos del negocio que usa el bot de WhatsApp.
   Sin precios: todo se presupuesta a medida tras una llamada gratis.
   Los nombres y plazos también están en assets/site.js (SERVICES).
   ============================================================= */
export const WEB = 'https://lagoa-webs.vercel.app';
export const PRIVACIDAD = `${WEB}/#privacidad`;

export const SERVICIOS = [
  { id: 'web', es: 'Web con reservas', gl: 'Web con reservas', plazo: { es: '3-4 semanas', gl: '3-4 semanas' } },
  { id: 'wa', es: 'Asistente de WhatsApp', gl: 'Asistente de WhatsApp', plazo: { es: '2-3 semanas', gl: '2-3 semanas' } },
  { id: 'shop', es: 'Tienda online', gl: 'Tenda online', plazo: { es: '4-6 semanas', gl: '4-6 semanas' } },
  { id: 'seo', es: 'Google Maps y SEO local', gl: 'Google Maps e SEO local', plazo: { es: '1 semana', gl: '1 semana' } }
];
export const PACK = { es: 'Web + WhatsApp (misma agenda)', gl: 'Web + WhatsApp (mesma axenda)', plazo: { es: '5-7 semanas', gl: '5-7 semanas' } };

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const eur = n => euros.format(n);
