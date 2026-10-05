/* =============================================================
   Cerebro del bot de WhatsApp
   Recibe lo que ha escrito el cliente y el punto de la conversación
   en el que está (paso + datos) y decide qué contestar.

   responder(chat, entrada) → { mensajes, paso, datos, idioma, humano }
     chat:    { telefono, nombre, idioma, paso, datos }
     entrada: { tipo: 'texto', texto } | { tipo: 'opcion', id, texto } | { tipo: 'otro' }

   Los pasos de una reserva: modalidad → dia → hora → nombre → negocio → confirmar
   ============================================================= */
import { query } from './db.js';
import { DIAS_VISTA, hoyMadrid, sumarDias, horasDelDia, huecoReservable } from './horario.js';
import { MODALIDADES, MAX_CITAS_POR_TELEFONO, guardarCita, citasActivasDe, anularCitaDe } from './citas.js';
import { SERVICIOS, PACK, PRIVACIDAD, eur } from './negocio.js';

/* ---------- Textos (castellano y gallego) ---------- */
const T = {
  es: {
    hola: n => `¡Hola${n ? ', ' + n : ''}! Soy el asistente de *Lagoa · Estudio digital*. Te respondo al momento sobre servicios, tarifas y plazos, y puedo reservarte una consulta rápida sin compromiso con Nadia.`,
    menuTexto: '¿En qué puedo ayudarte? Toca *Ver opciones*.',
    menuBoton: 'Ver opciones',
    menu: {
      servicios: ['Servicios', 'Qué hago y para quién'],
      precios: ['Tarifas', 'Precios cerrados, IVA incluido'],
      plazos: ['Plazos', 'Cuánto se tarda'],
      mantenimiento: ['Mantenimiento', 'Cuotas mensuales opcionales'],
      reservar: ['Reservar consulta', 'Gratis y sin compromiso'],
      miscitas: ['Mis citas', 'Ver o cancelar tus citas'],
      nadia: ['Hablar con Nadia', 'Te responde ella en persona']
    },
    b: { menu: 'Menú', reservar: 'Reservar consulta', nadia: 'Hablar con Nadia', confirmar: 'Confirmar', cambiar: 'Cambiar hora', cancelar: 'Cancelar', saltar: 'Saltar', si: 'Sí, cancelarla', no: 'No', soy: n => `Soy ${n}`, dias: 'Ver días', horas: 'Ver horas', otroDia: '« Otro día', libres: n => `${n} ${n === 1 ? 'hora libre' : 'horas libres'}`, anular: f => `Cancelar ${f}` },
    servicios: () => `Ayudo a negocios en crecimiento de A Coruña a estar en internet sin complicaciones:\n\n${SERVICIOS.map(s => `• *${s.es}*: ${eur(s.precio)}`).join('\n')}\n• *${PACK.es}*: ${eur(PACK.precio)}\n\nTambién cosas a medida: panel de ventas y stock, facturas automáticas, tarjeta de fidelización y mucho más.`,
    precios: () => `Tarifas fijas de lanzamiento, pago único, *IVA incluido*:\n\n${SERVICIOS.map(s => `• ${s.es}: ${eur(s.precio)}`).join('\n')}\n• ${PACK.es}: ${eur(PACK.precio)}\n\nEl mantenimiento mensual es opcional (escribe *mantenimiento* para verlo).`,
    plazos: () => `Plazos orientativos:\n\n${[...SERVICIOS, PACK].map(s => `• ${s.es}: ${s.plazo.es}`).join('\n')}\n\nEmpiezan a contar cuando Nadia tiene tus textos y fotos.`,
    mantenimiento: () => `El mantenimiento es *opcional* y se puede cancelar cuando quieras (IVA incluido):\n\n${[...SERVICIOS.filter(s => s.mes), PACK].map(s => `• ${s.es}: ${eur(s.mes)}/mes`).join('\n')}\n\nIncluye copias de seguridad, revisión y parches en caso de error, cambios pequeños ilimitados y soporte por WhatsApp o email.`,
    zona: () => 'Nadia trabaja con negocios de A Coruña. Si el tuyo está en otra zona, escríbele y valorará tu caso.',
    iva: () => 'Todos los precios ya incluyen el IVA (21 %).',
    pago: () => 'Las condiciones de pago las explica Nadia personalmente. Toca *Hablar con Nadia* y te responderá ella.',
    gracias: () => '¡Gracias a ti! Si necesitas algo más, aquí estoy.',
    noEntiendo: 'No estoy seguro de haberte entendido. Puedes elegir una opción del menú o hablar directamente con Nadia.',
    soloTexto: 'Por ahora solo puedo leer mensajes de texto. Si quieres enviar audios o fotos, toca *Hablar con Nadia*.',
    nadia: 'Perfecto. He avisado a Nadia y te responderá *personalmente por aquí* en cuanto pueda (normalmente el mismo día).\n\nMientras tanto el asistente queda en pausa. Si quieres volver a usarlo, escribe *menú*.',
    modalidad: '¡Genial! La consulta rápida es *gratis y sin compromiso* (unos 20 minutos) para ver tu negocio y lo que más tiempo te quita.\n\n¿Cómo la prefieres? (En persona solo en A Coruña ciudad.)',
    modos: ['Videollamada', 'Llamada', 'En persona'],
    elegirDia: '¿Qué día te viene bien? Toca *Ver días*.',
    elegirHora: f => `Horas libres el *${f}* (hora de España). Toca *Ver horas*.`,
    sinHuecos: 'Ahora mismo no quedan horas libres en las próximas dos semanas. Escribe a Nadia y buscaréis un hueco.',
    horaOcupada: 'Vaya, esa hora se acaba de ocupar. Elige otra, por favor.',
    nombre: '¿A nombre de quién apunto la cita? Escribe tu nombre.',
    nombreMal: 'Escribe tu nombre, por favor (solo texto).',
    negocio: '¿Cómo se llama tu negocio? Si prefieres no decirlo, toca *Saltar*.',
    resumen: d => `Revisa tu cita:\n\n📅 *${d.fechaTexto}* a las *${d.hora}*\n💬 ${d.modalidad}\n👤 ${d.nombre}${d.negocio ? `\n🏪 ${d.negocio}` : ''}\n\nAl confirmar aceptas la política de privacidad: ${PRIVACIDAD}`,
    hecho: d => `¡Listo! Tu solicitud para el *${d.fechaTexto}* a las *${d.hora}* está guardada. Nadia te la confirmará por aquí. ¡Gracias!`,
    limite: `Ya tienes ${MAX_CITAS_POR_TELEFONO} citas pendientes con este número. Si necesitas otra, habla con Nadia.`,
    cancelado: 'De acuerdo, no he guardado nada.',
    sinCitas: 'No tienes citas próximas con este número.',
    tusCitas: c => `Tus próximas citas:\n\n${c.join('\n')}`,
    estado: { pendiente: 'pendiente de confirmar', confirmada: 'confirmada' },
    anularPregunta: f => `¿Seguro que quieres cancelar tu cita del *${f}*?`,
    anulada: 'Hecho: tu cita está cancelada y la hora queda libre. Si quieres otra, toca *Reservar consulta*.',
    noAnulada: 'No he encontrado esa cita (puede que ya estuviera cancelada).',
    usaBotones: 'Elige una de las opciones tocando el botón, o escribe *cancelar* para salir.',
    fmt: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    fmtMedio: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    fmtCorto: new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  },
  gl: {
    hola: n => `Ola${n ? ', ' + n : ''}! Son o asistente de *Lagoa · Estudio dixital*. Respóndoche ao momento sobre servizos, tarifas e prazos, e podo reservarche unha consulta rápida sen compromiso con Nadia.`,
    menuTexto: 'En que podo axudarche? Toca *Ver opcións*.',
    menuBoton: 'Ver opcións',
    menu: {
      servicios: ['Servizos', 'Que fago e para quen'],
      precios: ['Tarifas', 'Prezos pechados, IVE incluído'],
      plazos: ['Prazos', 'Canto se tarda'],
      mantenimiento: ['Mantemento', 'Cotas mensuais opcionais'],
      reservar: ['Reservar consulta', 'De balde e sen compromiso'],
      miscitas: ['As miñas citas', 'Ver ou cancelar as túas citas'],
      nadia: ['Falar con Nadia', 'Respóndeche ela en persoa']
    },
    b: { menu: 'Menú', reservar: 'Reservar consulta', nadia: 'Falar con Nadia', confirmar: 'Confirmar', cambiar: 'Cambiar hora', cancelar: 'Cancelar', saltar: 'Saltar', si: 'Si, cancelala', no: 'Non', soy: n => `Son ${n}`, dias: 'Ver días', horas: 'Ver horas', otroDia: '« Outro día', libres: n => `${n} ${n === 1 ? 'hora libre' : 'horas libres'}`, anular: f => `Cancelar ${f}` },
    servicios: () => `Axudo a negocios en crecemento da Coruña a estar en internet sen complicacións:\n\n${SERVICIOS.map(s => `• *${s.gl}*: ${eur(s.precio)}`).join('\n')}\n• *${PACK.gl}*: ${eur(PACK.precio)}\n\nTamén cousas a medida: panel de vendas e stock, facturas automáticas, tarxeta de fidelización e moito máis.`,
    precios: () => `Tarifas fixas de lanzamento, pagamento único, *IVE incluído*:\n\n${SERVICIOS.map(s => `• ${s.gl}: ${eur(s.precio)}`).join('\n')}\n• ${PACK.gl}: ${eur(PACK.precio)}\n\nO mantemento mensual é opcional (escribe *mantemento* para velo).`,
    plazos: () => `Prazos orientativos:\n\n${[...SERVICIOS, PACK].map(s => `• ${s.gl}: ${s.plazo.gl}`).join('\n')}\n\nComezan a contar cando Nadia ten os teus textos e fotos.`,
    mantenimiento: () => `O mantemento é *opcional* e pódese cancelar cando queiras (IVE incluído):\n\n${[...SERVICIOS.filter(s => s.mes), PACK].map(s => `• ${s.gl}: ${eur(s.mes)}/mes`).join('\n')}\n\nInclúe copias de seguridade, revisión e parches en caso de erro, cambios pequenos ilimitados e soporte por WhatsApp ou email.`,
    zona: () => 'Nadia traballa con negocios da Coruña. Se o teu está noutra zona, escríbelle e valorará o teu caso.',
    iva: () => 'Todos os prezos xa inclúen o IVE (21 %).',
    pago: () => 'As condicións de pagamento explícaas Nadia persoalmente. Toca *Falar con Nadia* e responderache ela.',
    gracias: () => 'Grazas a ti! Se precisas algo máis, aquí estou.',
    noEntiendo: 'Non estou seguro de entenderte. Podes escoller unha opción do menú ou falar directamente con Nadia.',
    soloTexto: 'Polo de agora só podo ler mensaxes de texto. Se queres enviar audios ou fotos, toca *Falar con Nadia*.',
    nadia: 'Perfecto. Aviseille a Nadia e responderache *persoalmente por aquí* en canto poida (normalmente o mesmo día).\n\nMentres tanto o asistente queda en pausa. Se queres volver usalo, escribe *menú*.',
    modalidad: 'Xenial! A consulta rápida é *de balde e sen compromiso* (uns 20 minutos) para ver o teu negocio e o que máis tempo che quita.\n\nComo a prefires? (En persoa só na cidade da Coruña.)',
    modos: ['Videochamada', 'Chamada', 'En persoa'],
    elegirDia: 'Que día che vén ben? Toca *Ver días*.',
    elegirHora: f => `Horas libres o *${f}* (hora de España). Toca *Ver horas*.`,
    sinHuecos: 'Agora mesmo non quedan horas libres nas próximas dúas semanas. Escríbelle a Nadia e buscaredes un oco.',
    horaOcupada: 'Vaia, esa hora acaba de ocuparse. Escolle outra, por favor.',
    nombre: 'A nome de quen apunto a cita? Escribe o teu nome.',
    nombreMal: 'Escribe o teu nome, por favor (só texto).',
    negocio: 'Como se chama o teu negocio? Se prefires non dicilo, toca *Saltar*.',
    resumen: d => `Revisa a túa cita:\n\n📅 *${d.fechaTexto}* ás *${d.hora}*\n💬 ${d.modalidad}\n👤 ${d.nombre}${d.negocio ? `\n🏪 ${d.negocio}` : ''}\n\nAo confirmar aceptas a política de privacidade: ${PRIVACIDAD}`,
    hecho: d => `Listo! A túa solicitude para o *${d.fechaTexto}* ás *${d.hora}* está gardada. Nadia confirmarácha por aquí. Grazas!`,
    limite: `Xa tes ${MAX_CITAS_POR_TELEFONO} citas pendentes con este número. Se precisas outra, fala con Nadia.`,
    cancelado: 'De acordo, non gardei nada.',
    sinCitas: 'Non tes citas próximas con este número.',
    tusCitas: c => `As túas próximas citas:\n\n${c.join('\n')}`,
    estado: { pendiente: 'pendente de confirmar', confirmada: 'confirmada' },
    anularPregunta: f => `Seguro que queres cancelar a túa cita do *${f}*?`,
    anulada: 'Feito: a túa cita está cancelada e a hora queda libre. Se queres outra, toca *Reservar consulta*.',
    noAnulada: 'Non atopei esa cita (pode que xa estivese cancelada).',
    usaBotones: 'Escolle unha das opcións tocando o botón, ou escribe *cancelar* para saír.',
    fmt: new Intl.DateTimeFormat('gl-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
    fmtMedio: new Intl.DateTimeFormat('gl-ES', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }),
    fmtCorto: new Intl.DateTimeFormat('gl-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  }
};

/* ---------- Palabras clave para entender texto libre ----------
   El orden importa: se elige el PRIMER tema que coincida. */
const CLAVES = [
  ['nadia', ['hablar con', 'falar con', 'una persona', 'unha persoa', 'humano', 'llamame', 'chamame']],
  ['miscitas', ['mis citas', 'mi cita', 'as minas citas', 'a mina cita', 'anular']],
  ['cancelar', ['cancelar', 'salir', 'sair', 'parar']],
  ['menu', ['menu', 'inicio', 'opciones', 'opcions', 'volver']],
  ['reservar', ['reserv', 'consulta rapida', 'cita', 'quedar', 'reunion', 'cafe']],
  ['iva', ['iva', 'ive', 'impuesto', 'imposto']],
  ['mantenimiento', ['mantenimiento', 'mantemento', 'cuota', 'cota', 'mensual', 'al mes', 'ao mes']],
  ['plazos', ['plazo', 'prazo', 'cuanto tarda', 'canto tarda', 'semanas', 'cuanto tiempo', 'canto tempo']],
  ['pago', ['pagar', 'pago', 'pagamento', 'financ', 'fraccion', 'factura']],
  ['precios', ['precio', 'prezo', 'cuesta', 'custa', 'cuanto vale', 'canto vale', 'tarifa', 'coste', 'custo', 'presupuesto', 'orzamento', 'euros']],
  ['servicios', ['servicio', 'servizo', 'que haces', 'que fas', 'ofreces', 'web', 'tienda', 'tenda', 'google', 'whatsapp', 'seo']],
  ['zona', ['zona', 'donde', 'onde', 'coruna', 'ciudad', 'cidade']],
  ['gracias', ['gracias', 'grazas']],
  ['hola', ['hola', 'ola', 'buenas', 'boas', 'buenos dias', 'bos dias']]
];
const normaliza = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').trim();
export function temaDe(texto) {
  const q = normaliza(texto);
  if (/^(galego|en galego)$/.test(q)) return 'idioma:gl';
  if (/^(castellano|espanol|en castellano)$/.test(q)) return 'idioma:es';
  const hit = CLAVES.find(([, palabras]) => palabras.some(p => q.includes(p)));
  return hit ? hit[0] : null;
}
/** ¿El primer mensaje está en gallego? (para contestar en su idioma) */
export const pareceGallego = texto => /\b(ola|boas|bos dias|grazas|queria|teno|tes|canto|prezo)\b/.test(normaliza(texto));

/* ---------- Mensajes reutilizables ---------- */
const btn = (id, titulo) => ({ id, titulo });
const t = idioma => T[idioma] || T.es;

function menu(L) {
  return {
    texto: L.menuTexto,
    lista: {
      boton: L.menuBoton, seccion: 'Lagoa',
      filas: Object.entries(L.menu).map(([id, [titulo, descripcion]]) => ({ id: `tema:${id}`, titulo, descripcion }))
    }
  };
}
const despues = (L, texto) => ({ texto, botones: [btn('tema:reservar', L.b.reservar), btn('tema:menu', L.b.menu), btn('tema:nadia', L.b.nadia)] });

/* ---------- Huecos libres (mismas reglas que la web) ---------- */
async function diasLibres() {
  const hoy = hoyMadrid();
  const hasta = sumarDias(hoy, DIAS_VISTA);
  const { rows } = await query(
    `SELECT to_char(fecha, 'YYYY-MM-DD') || ' ' || to_char(hora, 'HH24:MI') AS k
       FROM citas WHERE estado <> 'cancelada' AND fecha BETWEEN $1 AND $2
     UNION
     SELECT to_char(fecha, 'YYYY-MM-DD') || ' ' || to_char(hora, 'HH24:MI')
       FROM bloqueos WHERE fecha BETWEEN $1 AND $2`, [hoy, hasta]);
  const ocupados = new Set(rows.map(r => r.k));
  const dias = [];
  for (let i = 0; i <= DIAS_VISTA; i++) {
    const fecha = sumarDias(hoy, i);
    const horas = horasDelDia(fecha).filter(h => huecoReservable(fecha, h) && !ocupados.has(`${fecha} ${h}`));
    if (horas.length) dias.push({ fecha, horas });
  }
  return dias;
}

const fechaLarga = (L, f) => { const s = L.fmt.format(new Date(f + 'T00:00:00Z')); return s.charAt(0).toUpperCase() + s.slice(1); };
const fechaCorta = (L, f) => L.fmtCorto.format(new Date(f + 'T00:00:00Z')).replace(/[.,]/g, '');
const fechaMedia = (L, f) => { const s = L.fmtMedio.format(new Date(f + 'T00:00:00Z')).replace(/\./g, ''); return s.charAt(0).toUpperCase() + s.slice(1); };

async function preguntarDia(L, datos, aviso) {
  const dias = (await diasLibres()).slice(0, 10); // WhatsApp admite 10 opciones por lista
  if (!dias.length) return { mensajes: [{ texto: L.sinHuecos, botones: [btn('tema:nadia', L.b.nadia), btn('tema:menu', L.b.menu)] }], paso: null, datos: {} };
  const mensajes = aviso ? [{ texto: aviso }] : [];
  mensajes.push({ texto: L.elegirDia, lista: { boton: L.b.dias, seccion: 'Días', filas: dias.map(d => ({ id: `dia:${d.fecha}`, titulo: fechaMedia(L, d.fecha), descripcion: L.b.libres(d.horas.length) })) } });
  return { mensajes, paso: 'dia', datos };
}

async function preguntarHora(L, datos, aviso) {
  const dia = (await diasLibres()).find(d => d.fecha === datos.fecha);
  if (!dia) return preguntarDia(L, datos, L.horaOcupada);
  const mensajes = aviso ? [{ texto: aviso }] : [];
  mensajes.push({ texto: L.elegirHora(fechaLarga(L, datos.fecha)), lista: { boton: L.b.horas, seccion: 'Horas', filas: [
    ...dia.horas.map(h => ({ id: `hora:${h}`, titulo: h })),
    { id: 'volver:dia', titulo: L.b.otroDia }
  ] } });
  return { mensajes, paso: 'hora', datos };
}

function resumen(L, d) {
  return { texto: L.resumen({ ...d, fechaTexto: fechaLarga(L, d.fecha) }), botones: [btn('ok', L.b.confirmar), btn('volver:dia', L.b.cambiar), btn('tema:cancelar', L.b.cancelar)] };
}

async function misCitas(L, telefono) {
  const citas = await citasActivasDe(telefono);
  if (!citas.length) return { mensajes: [{ texto: L.sinCitas, botones: [btn('tema:reservar', L.b.reservar), btn('tema:menu', L.b.menu)] }], paso: null, datos: {} };
  const lineas = citas.map(c => `• *${fechaLarga(L, c.fecha)}* a las ${c.hora} · ${c.modalidad} (${L.estado[c.estado]})`);
  const botones = citas.slice(0, 2).map(c => btn(`anular:${c.id}`, L.b.anular(fechaCorta(L, c.fecha))));
  return { mensajes: [{ texto: L.tusCitas(lineas), botones: [...botones, btn('tema:menu', L.b.menu)] }], paso: null, datos: {} };
}

/* ---------- Temas del menú ---------- */
async function tema(nombre, chat, L) {
  const info = { servicios: L.servicios, precios: L.precios, plazos: L.plazos, mantenimiento: L.mantenimiento, zona: L.zona, iva: L.iva, gracias: L.gracias };
  if (info[nombre]) return { mensajes: [despues(L, info[nombre]())], paso: null, datos: {} };
  switch (nombre) {
    case 'menu': return { mensajes: [menu(L)], paso: null, datos: {} };
    case 'hola': return { mensajes: [{ texto: L.hola(chat.nombre) }, menu(L)], paso: null, datos: {} };
    case 'pago': return { mensajes: [{ texto: L.pago(), botones: [btn('tema:nadia', L.b.nadia), btn('tema:menu', L.b.menu)] }], paso: null, datos: {} };
    case 'nadia': return { mensajes: [{ texto: L.nadia }], paso: null, datos: {}, humano: true };
    case 'cancelar': return { mensajes: [{ texto: L.cancelado, botones: [btn('tema:menu', L.b.menu)] }], paso: null, datos: {} };
    case 'miscitas': return misCitas(L, chat.telefono);
    case 'reservar':
      if ((await citasActivasDe(chat.telefono)).length >= MAX_CITAS_POR_TELEFONO) {
        return { mensajes: [{ texto: L.limite, botones: [btn('tema:miscitas', L.menu.miscitas[0]), btn('tema:nadia', L.b.nadia)] }], paso: null, datos: {} };
      }
      return { mensajes: [{ texto: L.modalidad, botones: L.modos.map((m, i) => btn(`mod:${i}`, m)) }], paso: 'modalidad', datos: {} };
  }
  return { mensajes: [{ texto: L.noEntiendo, botones: [btn('tema:menu', L.b.menu), btn('tema:nadia', L.b.nadia)] }], paso: null, datos: {} };
}

/** Saludo para el primer mensaje de un cliente nuevo */
export const saludo = (idioma, nombre) => ({ texto: t(idioma).hola(nombre) });

/* ---------- Punto de entrada ---------- */
export async function responder(chat, entrada) {
  let idioma = chat.idioma || 'es';
  const datos = { ...(chat.datos || {}) };
  const id = entrada.tipo === 'opcion' ? entrada.id : '';
  const texto = entrada.tipo === 'texto' ? String(entrada.texto || '').trim() : '';
  const fin = r => ({ idioma, paso: null, datos: {}, humano: false, ...r });

  // Audios, fotos, ubicaciones… el bot no los entiende
  if (entrada.tipo === 'otro') {
    const L = t(idioma);
    return fin({ mensajes: [{ texto: L.soloTexto, botones: [btn('tema:nadia', L.b.nadia), btn('tema:menu', L.b.menu)] }], paso: chat.paso, datos });
  }

  // Cambiar de idioma en cualquier momento
  const temaTexto = texto ? temaDe(texto) : null;
  if (temaTexto?.startsWith('idioma:')) {
    idioma = temaTexto.slice(7);
    return fin({ mensajes: [menu(t(idioma))] });
  }
  const L = t(idioma);

  // Botones y listas: el id dice exactamente qué ha elegido
  if (id.startsWith('tema:')) return fin(await tema(id.slice(5), chat, L));
  if (id.startsWith('anular:')) {
    const n = Number(id.slice(7));
    const cita = (await citasActivasDe(chat.telefono)).find(c => c.id === n);
    if (!cita) return fin({ mensajes: [{ texto: L.noAnulada, botones: [btn('tema:menu', L.b.menu)] }] });
    return fin({ mensajes: [{ texto: L.anularPregunta(`${fechaLarga(L, cita.fecha)} ${cita.hora}`), botones: [btn(`anularok:${n}`, L.b.si), btn('tema:miscitas', L.b.no)] }] });
  }
  if (id.startsWith('anularok:')) {
    const ok = await anularCitaDe(Number(id.slice(9)), chat.telefono);
    return fin({ mensajes: [{ texto: ok ? L.anulada : L.noAnulada, botones: [btn('tema:reservar', L.b.reservar), btn('tema:menu', L.b.menu)] }] });
  }

  // Palabras que funcionan en cualquier paso: cancelar, menú, hablar con Nadia
  if (['cancelar', 'menu', 'nadia'].includes(temaTexto)) return fin(await tema(temaTexto, chat, L));

  // ¿Está a mitad de una reserva?
  switch (chat.paso) {
    case 'modalidad': {
      const m = id.match(/^mod:(\d)$/);
      if (!m) return fin({ mensajes: [{ texto: L.usaBotones, botones: L.modos.map((x, i) => btn(`mod:${i}`, x)) }], paso: 'modalidad', datos });
      datos.modalidad = MODALIDADES[Number(m[1])];
      return fin(await preguntarDia(L, datos));
    }
    case 'dia': {
      const m = id.match(/^dia:(\d{4}-\d{2}-\d{2})$/);
      if (!m) return fin(await preguntarDia(L, datos, L.usaBotones));
      datos.fecha = m[1];
      return fin(await preguntarHora(L, datos));
    }
    case 'hora': {
      if (id === 'volver:dia') return fin(await preguntarDia(L, datos));
      const m = id.match(/^hora:(\d{2}:\d{2})$/);
      if (!m) return fin(await preguntarHora(L, datos, L.usaBotones));
      const dia = (await diasLibres()).find(d => d.fecha === datos.fecha);
      if (!dia || !dia.horas.includes(m[1])) return fin(await preguntarHora(L, datos, L.horaOcupada));
      datos.hora = m[1];
      const botones = chat.nombre ? [btn('nombre:perfil', L.b.soy(chat.nombre))] : null;
      return fin({ mensajes: [botones ? { texto: L.nombre, botones } : { texto: L.nombre }], paso: 'nombre', datos });
    }
    case 'nombre': {
      const nombre = id === 'nombre:perfil' ? chat.nombre : texto;
      if (!nombre || nombre.length > 100) return fin({ mensajes: [{ texto: L.nombreMal }], paso: 'nombre', datos });
      datos.nombre = nombre;
      return fin({ mensajes: [{ texto: L.negocio, botones: [btn('negocio:no', L.b.saltar)] }], paso: 'negocio', datos });
    }
    case 'negocio': {
      datos.negocio = id === 'negocio:no' ? '' : texto.slice(0, 120);
      if (id !== 'negocio:no' && !texto) return fin({ mensajes: [{ texto: L.negocio, botones: [btn('negocio:no', L.b.saltar)] }], paso: 'negocio', datos });
      return fin({ mensajes: [resumen(L, datos)], paso: 'confirmar', datos });
    }
    case 'confirmar': {
      if (id === 'volver:dia') return fin(await preguntarDia(L, datos));
      if (id !== 'ok') return fin({ mensajes: [{ texto: L.usaBotones }, resumen(L, datos)], paso: 'confirmar', datos });
      if (!huecoReservable(datos.fecha, datos.hora)) return fin(await preguntarDia(L, datos, L.horaOcupada));
      const r = await guardarCita({ ...datos, telefono: '+' + chat.telefono, nota: 'Reservada por WhatsApp' }, 'whatsapp');
      if (r.estado === 429) return fin({ mensajes: [{ texto: L.limite, botones: [btn('tema:miscitas', L.menu.miscitas[0]), btn('tema:nadia', L.b.nadia)] }] });
      if (r.estado !== 201) return fin(await preguntarHora(L, datos, L.horaOcupada));
      return fin({ mensajes: [{ texto: L.hecho({ ...datos, fechaTexto: fechaLarga(L, datos.fecha) }), botones: [btn('tema:miscitas', L.menu.miscitas[0]), btn('tema:menu', L.b.menu)] }] });
    }
  }

  // Sin reserva en marcha: texto libre → buscar el tema por palabras clave
  if (texto) return fin(await tema(temaTexto || 'desconocido', chat, L));
  return fin(await tema('menu', chat, L));
}
