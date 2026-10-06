# Website with online bookings and a private agenda — complete tutorial

> **What this is:** the step-by-step guide to rebuild the Lagoa website (public site + booking system + private admin panel + WhatsApp bot) for any client, without help.
> Everything here comes from the real, working code in this repository (`web-profesional/`), and every code block below is an exact copy of a real file.
>
> **Repository:** `lagoanadia/Web-Fiction` · **Live example:** https://lagoa-webs.vercel.app · **Panel:** https://lagoa-webs.vercel.app/admin

---

## Table of contents

0. [What you are building](#0-what-you-are-building)
1. [Tools and accounts](#1-tools-and-accounts)
2. [Fast path: a new client in 12 steps](#2-fast-path-a-new-client-in-12-steps)
3. [Project structure](#3-project-structure)
4. [Part 1 — The public website](#4-part-1--the-public-website)
5. [Part 2 — The backend (every function)](#5-part-2--the-backend-every-function)
6. [Part 3 — The admin panel](#6-part-3--the-admin-panel)
7. [Part 4 — Testing on your computer](#7-part-4--testing-on-your-computer)
8. [Part 5 — Publishing on Vercel](#8-part-5--publishing-on-vercel)
9. [Part 6 — Handing it over to the client](#9-part-6--handing-it-over-to-the-client)
10. [Maintenance and troubleshooting](#10-maintenance-and-troubleshooting)
11. [Security checklist](#11-security-checklist)
12. [Ideas to extend it](#12-ideas-to-extend-it)
13. [Part 7 — The WhatsApp bot](#13-part-7--the-whatsapp-bot)

---

## 0. What you are building

Three pieces that work together:

| Piece | What it is | Files |
|---|---|---|
| **Public website** | One HTML page: services, prices, budget calculator, chatbot, booking form, contact form, FAQ | `index.html`, `img/`, `robots.txt`, `sitemap.xml` |
| **Backend (API)** | Small server functions that Vercel runs on demand. They check and save bookings in a Postgres database | `api/` + `package.json` |
| **Admin panel** | A private page with a password where the owner sees the week, confirms, cancels, blocks slots and adds bookings by hand, and answers WhatsApp chats | `admin/index.html` |
| **WhatsApp bot** (optional) | Answers automatically inside WhatsApp, books in the same agenda, hands the chat to the owner when asked (section 13) | `api/whatsapp.js`, `api/_lib/bot.js`… |

How a booking travels:

```
CLIENT (website)                      VERCEL (functions)                       NEON (Postgres)
────────────────                      ──────────────────                       ───────────────
Opens the booking form ─GET /api/disponibilidad─▶ reads taken hours ─────SQL──▶ citas + bloqueos
Picks day + hour, sends ─POST /api/reservas────▶ validates and saves ────SQL──▶ INSERT INTO citas
                                                  (hour already taken → 409)    (unique index)
(also sends an email copy through FormSubmit, as a backup)

OWNER (/admin)
Types password ─────────POST /api/admin/login──▶ checks it, sets a signed cookie
Sees / changes bookings ─/api/admin/citas──────▶ reads / updates ────────SQL──▶ SELECT / UPDATE
Blocks a slot ──────────/api/admin/bloqueos────▶ saves the block ────────SQL──▶ INSERT INTO bloqueos
```

**Key ideas to remember**

- The website is **static** (plain HTML/CSS/JS). It cannot store anything by itself; that is why we need the functions plus the database.
- **Never trust the browser.** Anyone can skip your JavaScript and call the API directly, so the server re-validates everything.
- **The database protects the important rule** ("one booking per hour") with a unique index. JavaScript checks can be skipped; the database cannot.
- **Secrets** (database address, panel password) live in Vercel **environment variables**: never in the code, never on GitHub.
- **Graceful fallback:** if the database fails, the website still sends the booking by email, so no client is lost.

**Costs:** Vercel Hobby (free), Neon free plan (0.5 GB, more than enough for thousands of bookings), FormSubmit (free). A custom domain costs about 10–15 €/year. WhatsApp Cloud API: answering clients inside the 24 h window is free; template messages (reminders, marketing) are paid per message (section 13.2).

> ⚠️ **Vercel Hobby is for personal, non-commercial use.** For a paying client's business, the client's project should be on **Vercel Pro**, or you need to check Vercel's current terms. Mention this cost in your quote.

---

## 1. Tools and accounts

**On your computer**

| Tool | Why | Check it works |
|---|---|---|
| **Node.js 20 or newer** | Runs the functions locally and the tests | `node --version` |
| **Git** | Version control, upload to GitHub | `git --version` |
| **VS Code** (or IntelliJ) | Editor | — |
| **PostgreSQL 16** (optional but recommended) | Local database to test without touching the real one | `psql --version` |
| **Chrome/Firefox DevTools** | Inspect, mobile view (Ctrl+Shift+M), Network tab to watch API calls | — |

**Accounts (free)**

- **GitHub**: one repository per client.
- **Vercel**: hosting + functions. Sign in with GitHub so it can read your repositories.
- **Neon**: the Postgres database. You create it from inside Vercel (Storage tab), no separate signup needed.
- **FormSubmit**: no account; activated by clicking a link in an email (section 4.8).

---

## 2. Fast path: a new client in 12 steps

Use this once you understand the rest of the guide. Estimated time: **1–2 days** for a small business (most of it is content and photos).

1. **Collect from the client:** business name, address/zone, phone, WhatsApp, email, services and prices, opening hours / bookable hours, texts, photos (or permission to use free photos), logo, colours, and who is the legal owner (for the privacy policy).
2. **Create the repository:** on GitHub, create `client-name-web` (private). Copy the whole `web-profesional/` folder into it (it is the template). Do **not** copy `node_modules/`.
3. **Edit `index.html`** (section 4): texts, services, prices, `CONFIG`, `SERVICES`, chatbot answers, privacy policy, SEO tags, JSON-LD.
4. **Replace the photos** in `img/` (section 4.4) and the credits in the footer.
5. **Edit the bookable hours** in `api/_lib/horario.js` (section 5.4). This is the only place where the schedule lives.
6. **Adapt the booking fields** if the business needs them (for example "service" for a hairdresser). See section 5.8 and 6.
7. **Test locally** (section 7): `node tools/dev-server.mjs web-profesional` + `node tools/api-test.mjs`. Every test must say OK.
8. **Push to GitHub.**
9. **Vercel:** Add New Project → import the repository → Root Directory = the folder with `index.html` → Deploy (section 8).
10. **Vercel → Storage → Create Database → Neon**, region **Frankfurt (EU)**, connect to the project. This creates `DATABASE_URL`.
11. **Vercel → Settings → Environment Variables:** `ADMIN_PASSWORD` (a long password, at least 10 characters; the client chooses it). Then **Deployments → ⋯ → Redeploy**.
12. **Final checks** (section 8.6): make a real booking, see it in `/admin`, confirm, cancel. Activate FormSubmit. Connect the domain. Hand over (section 9).

**Optional — WhatsApp bot:** adapt the texts (13.7), run `tools/whatsapp-test.mjs`, then connect the client's number in Meta and add the 4 `WHATSAPP_…` variables (13.3). Start the Meta business verification early: it can take days.

---

## 3. Project structure

```
web-profesional/                ← this folder is the "Root Directory" in Vercel
├── index.html                  ← public website (HTML + CSS + JS in one file)
├── img/                        ← photos in WebP
├── robots.txt                  ← tells Google what not to index (/admin, /api)
├── sitemap.xml                 ← tells Google which pages exist
├── package.json                ← declares the "pg" library for the functions
├── package-lock.json           ← exact versions (generated by npm, commit it)
├── .gitignore                  ← node_modules, .env (never upload secrets)
├── admin/
│   └── index.html              ← private panel (served at /admin)
└── api/                        ← every .js here is a server function (URL = path)
    ├── disponibilidad.js       ← GET  /api/disponibilidad
    ├── reservas.js             ← POST /api/reservas
    ├── whatsapp.js             ← GET/POST /api/whatsapp (Meta calls it: WhatsApp bot)
    ├── admin/
    │   ├── login.js            ← POST /api/admin/login
    │   ├── logout.js           ← POST /api/admin/logout
    │   ├── sesion.js           ← GET  /api/admin/sesion
    │   ├── citas.js            ← GET/POST/PATCH /api/admin/citas
    │   ├── bloqueos.js         ← POST/DELETE /api/admin/bloqueos
    │   └── whatsapp.js         ← GET/POST/PATCH /api/admin/whatsapp (panel's WhatsApp tab)
    └── _lib/                   ← starts with "_" → NOT a URL, shared code only
        ├── db.js               ← database connection + tables
        ├── horario.js          ← bookable hours, time zone, date helpers
        ├── http.js             ← small helpers for requests/responses
        ├── auth.js             ← password check + signed session cookie
        ├── citas.js            ← booking rules shared by the website and the bot
        ├── negocio.js          ← business data for the bot (services, prices)
        ├── whatsapp.js         ← talks to Meta (send messages, check signatures)
        └── bot.js              ← the bot's brain (menu, answers, booking steps)

tools/ (at the repository root, never published)
├── dev-server.mjs              ← local server that imitates Vercel
├── api-test.mjs                ← 38 automatic tests of the API
└── whatsapp-test.mjs           ← 49 automatic tests of the WhatsApp bot (fake Meta)
```

**Rule of Vercel functions:** the file path is the URL. `api/reservas.js` answers at `/api/reservas`. Folders or files whose name starts with `_` are private helpers and never become URLs.

---

## 4. Part 1 — The public website

`index.html` is a single file with three parts: `<head>` (SEO), `<style>` (design) and `<script>` (behaviour). One file is easier to copy, has no build step and loads fast.

### 4.1 The `<head>`: SEO and sharing

Change these for every client:

| Tag | What to put | Why |
|---|---|---|
| `<title>` | `Business · what it does · city` (≈ 60 characters) | It is the blue link in Google |
| `<meta name="description">` | 1–2 sentences, ≈ 150 characters, with city and main service | Text under the link in Google |
| `<link rel="canonical">` | The final URL (custom domain if there is one) | Avoids duplicate versions |
| `og:title`, `og:description`, `og:url`, `og:image` | Same idea; `og:image` = absolute URL of the hero photo | Preview when the link is shared on WhatsApp/Instagram |
| `<script type="application/ld+json">` | Business type, name, URL, phone, email, area, prices | "Structured data": helps Google understand it is a local business |
| `<link rel="preload" as="image">` | The hero photo | The first photo appears faster |

JSON-LD tips: choose the right `@type` (`HairSalon`, `Bakery`, `TattooParlor`, `Restaurant`, `Store`, `ProfessionalService`…), and validate it at **https://validator.schema.org**. Prices in JSON-LD use a dot: `"290.00"`.

### 4.2 Design system (CSS)

All colours, fonts and sizes are **CSS variables** in `:root` at the top of the `<style>`. To re-theme the site for a client, change only those lines:

```css
:root {
  --paper: #f4f0e8;   /* background */
  --ink: #161513;     /* text */
  --accent: #6b8e23;  /* links and details */
  --serif: "Cormorant Garamond", Georgia, serif;   /* headings */
  --sans: "Manrope", system-ui, sans-serif;        /* body text */
  /* … */
}
```

Principles used (keep them for every client):

- **Mobile first:** base styles are for phones; `@media (min-width: 900px)` adds the desktop layout. Test at **360 px** and **1280 px**.
- **Contrast:** normal text needs a ratio of at least **4.5:1** against its background. Check at https://webaim.org/resources/contrastchecker/.
- **Visible focus:** `:focus-visible { outline: … }` so keyboard users see where they are.
- **`[hidden] { display: none !important; }`:** without it, a class like `.btn { display: inline-flex }` would show elements that should be hidden. This was a real bug.
- **No horizontal scroll:** `overflow-x: hidden` on `body`, `min-width: 0` on grid/flex children, `overflow-wrap: break-word` on headings.
- **Respect `prefers-reduced-motion`:** animations are wrapped in `@media (prefers-reduced-motion: no-preference)`.
- **Fonts** from Google Fonts with `display=swap`.

### 4.3 Sections and their IDs

The menu links, the chatbot and the calculator use these IDs. If you rename one, search the whole file for it.

| Section | ID | Notes |
|---|---|---|
| Hero (big photo) | `#inicio` | One `<h1>` per page, only here |
| Services | `#servicios` | Cards `#srv-web`, `#srv-whatsapp`, `#srv-tienda`, `#srv-google`, pack `#srv-pack` |
| How I work | `#como-trabajo` | |
| Maintenance | `#mantenimiento` | |
| Budget calculator | `#presupuesto` | Built by JS from `SERVICES` |
| Projects | `#trabajos` | |
| Contact + booking | `#contacto` | Tabs `#tab-reserva` / `#tab-mensaje` |
| FAQ | `#faq` | `<details>`, works without JS |

### 4.4 Images

1. **Where to get them (free and legal):**
   - Photos taken by the client: always the best option.
   - **Unsplash** / **Pexels**: free, no credit required.
   - **Openverse** (https://openverse.org): searches Wikimedia Commons, Flickr…; filter by licence. **CC0** = no credit needed; **CC BY** = you **must** credit author + licence + link (the footer of this site does it).
   - Never take photos from Google Images without checking the licence.
2. **Convert to WebP and resize** with https://squoosh.app: hero ~1920 px wide, cards ~1280 px, quality 70–75. **Target: under 300 KB per photo.** The whole page should stay under ~1.5 MB of images.
3. **Name files clearly** (`fachada.webp`, not `IMG_2034.webp`). Names are **case-sensitive** on Vercel: `Foto.webp` ≠ `foto.webp`.
4. In HTML always set `width`, `height` and `alt`:
   ```html
   <img src="img/fachada.webp" width="1280" height="850" alt="Shop front with the green awning" loading="lazy">
   ```
   - `loading="lazy"` on every photo **except** the hero (`fetchpriority="high"` there).
   - `alt=""` (empty) only for purely decorative photos.
5. Update `og:image`, the JSON-LD `image`, the `preload` link and the **credits** in the footer.

### 4.5 JavaScript on the page: every block

All the JS is at the end of `index.html`. Each block is an IIFE, `(function name() { … })();`, so its variables don't mix with the others.

| Block / function | What it does | What to change per client |
|---|---|---|
| `CONFIG` | WhatsApp number, email for FormSubmit, Google booking link, fallback schedule | **Everything** |
| `SERVICES`, `PACK`, `VAT` | Final prices (VAT included) for the calculator and chatbot | Services, prices, monthly fees, delivery times |
| `$`, `$$`, `el`, `eur`, `waLink` | Small helpers: select elements, create elements, format euros, build WhatsApp links | Nothing |
| `sendToEmail(subject, data)` | Sends a form to the owner's email through FormSubmit's AJAX endpoint | Nothing (the email comes from `CONFIG`) |
| `showStatus(box, ok, summary)` | Shows "received" or, on error, buttons to send the same text by WhatsApp/email | Texts if you like |
| `validate(form)` | Checks required fields and focuses the first empty one | Nothing |
| Tabs (`selectTab`) | Accessible tabs Booking / Message (arrow keys work) | Nothing |
| `booking()` | The booking form; see 4.6 | Nothing (hours come from the server) |
| `contact()` | Message form → email | Fields if needed |
| `calculator()` | Builds the checkboxes from `SERVICES`, applies the pack, shows the total and VAT part | Pack rule if different |
| `chatbot()` | FAQ assistant in Spanish/Galician that hands over to WhatsApp; see 4.7 | **All answers and keywords** |
| `services()` | Accordion of service cards (one open at a time) | Nothing |
| `navState()` | Transparent menu over the photo, solid after scrolling | Nothing |
| `mobileMenu()` | Hamburger menu on phones | Nothing |

### 4.6 The booking form (connected to the API)

How it decides what to show:

1. It paints the days with the **fallback schedule** from `CONFIG` (so the form is never empty).
2. It asks the server for the real schedule and taken hours (`GET /api/disponibilidad`). If the server answers, it uses that and hides taken hours. If not (no database yet), it keeps the fallback and bookings go by email.
3. On submit:
   - With server: `POST /api/reservas`. If OK → success + email copy to the owner. If the hour was taken meanwhile (**409**) → clear message and refreshed hours. If the server fails → falls back to email.
   - Without server: email only (the original behaviour).

From `web-profesional/index.html` (inside the main `<script>`):

```js
(function booking() {
  const daysBox = $('#res-days');
  const slotsBox = $('#res-slots');
  const fmtDay = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const state = { date: null, time: null };

  if (CONFIG.googleBookingUrl) {
    const g = $('#google-booking');
    g.href = CONFIG.googleBookingUrl;
    g.hidden = false;
  }

  /* Disponibilidad: la del servidor (agenda real) si responde; si no, la de CONFIG
     y las reservas se envían por email como antes. */
  let horario = CONFIG.availability;
  let diasVista = CONFIG.daysAhead;
  let antelacion = CONFIG.minHoursNotice;
  let ocupados = new Set();   // "AAAA-MM-DD HH:MM" ya reservadas o bloqueadas
  let conServidor = false;

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  /** Horas libres de un día: ni ocupadas ni sin la antelación mínima */
  function slotsFor(date) {
    const list = horario[date.getDay()] || [];
    const limit = Date.now() + antelacion * 3600e3;
    return list.filter(t => {
      if (ocupados.has(`${iso(date)} ${t}`)) return false;
      const [h, m] = t.split(':').map(Number);
      const d = new Date(date); d.setHours(h, m, 0, 0);
      return d.getTime() > limit;
    });
  }

  /** Pinta los próximos días con al menos una hora libre */
  function renderDays() {
    daysBox.replaceChildren();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= diasVista; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      if (!slotsFor(d).length) continue;
      const selected = state.date && iso(state.date) === iso(d);
      const b = el('button', { type: 'button', class: 'choice', 'aria-pressed': String(!!selected), 'aria-label': fmtLong.format(d) });
      const [wd, ...rest] = fmtDay.format(d).split(' ');
      b.append(el('small', {}, wd.replace(',', '')), document.createTextNode(rest.join(' ')));
      b.addEventListener('click', () => {
        state.date = d; state.time = null;
        $$('.choice', daysBox).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        renderSlots();
      });
      daysBox.append(b);
    }
    if (!daysBox.children.length) daysBox.append(el('p', { class: 'muted small' }, 'No quedan horas libres en los próximos días. Escríbeme por WhatsApp y buscamos un hueco.'));
  }

  function renderSlots() {
    slotsBox.replaceChildren();
    const libres = slotsFor(state.date);
    if (!libres.length) {
      slotsBox.append(el('p', { class: 'muted small' }, 'Ya no quedan horas libres este día. Elige otro.'));
      return;
    }
    libres.forEach(t => {
      const b = el('button', { type: 'button', class: 'choice', 'aria-pressed': String(state.time === t) }, t);
      b.addEventListener('click', () => {
        state.time = t;
        $$('.choice', slotsBox).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      });
      slotsBox.append(b);
    });
  }

  async function cargarDisponibilidad() {
    try {
      const r = await fetch('/api/disponibilidad', { cache: 'no-store' });
      if (!r.ok) throw new Error('sin servidor');
      const d = await r.json();
      horario = d.horario; diasVista = d.diasVista; antelacion = d.antelacionHoras;
      ocupados = new Set(d.ocupados);
      conServidor = true;
    } catch {
      conServidor = false; // web estática o base de datos sin configurar
    }
    if (state.time && state.date && !slotsFor(state.date).includes(state.time)) state.time = null;
    renderDays();
    if (state.date) renderSlots();
  }

  renderDays();
  cargarDisponibilidad();

  /** Guarda la reserva en la agenda. Devuelve 'ok', 'fallback' (usar email) o un error para el cliente */
  async function guardarEnAgenda(f) {
    try {
      const r = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: iso(state.date), hora: state.time,
          modalidad: f.get('modalidad'), nombre: f.get('nombre'), negocio: f.get('negocio'),
          telefono: f.get('telefono'), email: f.get('email'), nota: f.get('nota'),
          privacidad: true, _honey: f.get('_honey') || ''
        })
      });
      if (r.ok) return { estado: 'ok' };
      if ([400, 409, 429].includes(r.status)) {
        const d = await r.json().catch(() => ({}));
        return { estado: 'error', mensaje: d.error || 'No se ha podido reservar esa hora.', ocupada: r.status === 409 };
      }
    } catch { /* sin conexión con el servidor */ }
    return { estado: 'fallback' };
  }

  const form = $('#form-reserva');
  const status = $('#res-status');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.date || !state.time) {
      status.hidden = false; status.dataset.type = 'error';
      status.textContent = 'Selecciona un día y una hora.';
      (state.date ? slotsBox : daysBox).querySelector('button')?.focus();
      return;
    }
    if (!validate(form)) return;
    const f = new FormData(form);
    if (f.get('_honey')) return; // spam
    const when = `${fmtLong.format(state.date)} a las ${state.time}`;
    const data = {
      Tipo: 'Solicitud de consulta rápida',
      Cuándo: when,
      Modalidad: f.get('modalidad'),
      Nombre: f.get('nombre'),
      Negocio: f.get('negocio') || '—',
      Teléfono: f.get('telefono'),
      Email: f.get('email') || '—',
      Nota: f.get('nota') || '—'
    };
    const summary = `Hola Nadia, quiero reservar una consulta rápida.\n${Object.entries(data).slice(1).map(([k, v]) => `${k}: ${v}`).join('\n')}`;
    const btn = $('button[type=submit]', form);
    btn.disabled = true; btn.textContent = 'Enviando…';

    let ok;
    if (conServidor) {
      const r = await guardarEnAgenda(f);
      if (r.estado === 'error') {
        btn.disabled = false; btn.textContent = 'Solicitar cita';
        status.hidden = false; status.dataset.type = 'error'; status.textContent = r.mensaje;
        if (r.ocupada) { state.time = null; await cargarDisponibilidad(); }
        return;
      }
      if (r.estado === 'ok') {
        ok = true;
        sendToEmail(`Nueva reserva: ${data.Nombre} · ${when}`, data); // aviso por email a Nadia
      } else {
        ok = await sendToEmail(`Nueva reserva: ${data.Nombre} · ${when}`, data);
      }
    } else {
      ok = await sendToEmail(`Nueva reserva: ${data.Nombre} · ${when}`, data);
    }

    btn.disabled = false; btn.textContent = 'Solicitar cita';
    showStatus(status, ok, summary);
    if (ok) {
      status.textContent = `Solicitud enviada: ${when} (${data.Modalidad}). Recibirás la confirmación por WhatsApp o email.`;
      form.reset();
      state.date = state.time = null;
      slotsBox.replaceChildren(el('p', { class: 'muted small' }, 'Selecciona primero un día.'));
      cargarDisponibilidad();
    }
  });
})();
```

### 4.7 The chatbot

It is **not** artificial intelligence: it is a list of **topics**, each with **keywords** and an **answer**.

- The user's text is lower-cased and accents are removed (`normalize('NFD')`), so "Cuánto" = "cuanto".
- The **order of topics matters**: the first topic whose keyword appears wins. Put specific topics (prices of a service) before generic ones (prices).
- Unknown questions → `fallback` answer + WhatsApp button with the whole conversation already written. That text starts with "Quiero hablar contigo", which the WhatsApp bot recognises ("hablar con…") and passes straight to the owner (section 13).
- Avoid keywords that are part of other words ("bot" matched "botón") or that are too common ("meu" in Galician matched "o meu negocio").
- Payment terms, discounts or anything you haven't defined with the client must go to the human, never be invented by the bot.

To adapt: edit `T.es.answers`, `T.es.keys`, the quick buttons `T.es.quick`, and the same for `T.gl` (or remove the GL language if not needed).

### 4.8 Emails with FormSubmit

- The site posts JSON to `https://formsubmit.co/ajax/OWNER_EMAIL`.
- **Activation:** the first time a form is sent, FormSubmit emails the owner an activation link. **Until it is clicked, no emails arrive.** Do one test booking right after publishing and ask the client to click it.
- After activation you can replace the email in `CONFIG.email` by the random alias FormSubmit gives you, so the email doesn't appear in the page source.
- The hidden `_honey` field is a trap for spam robots.

### 4.9 Legal (Spain / GDPR)

The privacy dialog (`#privacy`) must name, for each client:

- **Who** is responsible (owner's legal name + contact).
- **What** data is collected and **why**.
- **Legal basis** (consent: the required checkbox).
- **Providers:** Vercel (hosting), Neon (database), FormSubmit (emails), Meta (WhatsApp).
- **How long** data is kept and the user's **rights** (access, correction, deletion; complaint to the AEPD).
- Cookies: this site only uses the panel's **session cookie**, which is technical (needed to log in), so no cookie banner is required. Adding Google Analytics or similar changes that.

> You are not a lawyer: for a business with many clients, recommend that the owner checks the texts with a gestoría or advisor.

### 4.10 `robots.txt` and `sitemap.xml`

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: https://CLIENT-DOMAIN/sitemap.xml
```

Update the domain in both files. After publishing, add the site in **Google Search Console** and submit the sitemap.

---

## 5. Part 2 — The backend (every function)

### 5.1 How a Vercel function works

Each file in `api/` exports one function:

```js
export default async function handler(req, res) {
  // req = the request: method (GET/POST…), url, headers, body (already parsed JSON)
  // res = the response: statusCode, setHeader(), end()
}
```

- Vercel starts it when someone calls the URL ("serverless"). Instances can be reused for a while, which is why the database connection is kept in a variable outside the function.
- `"type": "module"` in `package.json` lets us use `import`/`export`.
- HTTP status codes used: **200** OK · **201** created · **400** invalid data · **401** not logged in / bad signature · **403** wrong verify token · **404** not found · **405** wrong method · **409** conflict (slot taken, or WhatsApp 24 h window closed) · **415** not JSON · **429** too many · **500** server error · **502** WhatsApp refused the message · **503** database or WhatsApp not configured.

### 5.2 `package.json`

The only external library is **`pg`** (node-postgres), the standard Postgres client. Install it with `npm install pg` and commit `package.json` **and** `package-lock.json`. Vercel installs dependencies automatically on each deploy.

File: `web-profesional/package.json`

```json
{
  "name": "lagoa-web",
  "private": true,
  "description": "Web de Lagoa con reservas y panel de agenda (funciones de Vercel + Postgres)",
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "pg": "^8.23.1"
  }
}
```

`.gitignore` (never upload `node_modules` or secret files):

File: `web-profesional/.gitignore`

```
node_modules/
.env
.env.local
.vercel/
```

### 5.3 `api/_lib/db.js` — connection and tables

What to understand:

- **`pg.Pool`**: keeps the connection open between calls so it doesn't reconnect every time. `max: 1` because each function instance handles one request at a time.
- **SSL**: Neon requires an encrypted connection; locally (`localhost`) it is turned off.
- **The schema is created automatically** (`CREATE TABLE IF NOT EXISTS`) the first time any function runs. You never run SQL by hand to set up a new client.
- **Table `citas`**: one row per booking. `estado` can only be `pendiente`, `confirmada` or `cancelada` (a `CHECK` constraint). `origen` is `web` or `panel`.
- **The unique index** `citas_hueco_unico ON citas (fecha, hora) WHERE estado <> 'cancelada'` is the heart of the system. Postgres refuses a second active booking at the same date and hour, even if two clients press the button in the same millisecond. Cancelled bookings don't count, so a cancelled slot can be booked again.
- **Table `bloqueos`**: slots closed by the owner.
- **`query(text, params)`**: always use `$1, $2…` placeholders. **Never** build SQL by joining strings with user data: that is what makes SQL injection impossible.

File: `web-profesional/api/_lib/db.js`

```js
/* =============================================================
   Conexión a la base de datos (Postgres)
   - En Vercel, DATABASE_URL la crea la integración de Neon.
   - En local se puede apuntar a un Postgres propio.
   La primera consulta de cada instancia crea las tablas si no existen.
   ============================================================= */
import pg from 'pg';

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS citas (
    id         SERIAL PRIMARY KEY,
    fecha      DATE        NOT NULL,
    hora       TIME        NOT NULL,
    modalidad  TEXT        NOT NULL,
    nombre     TEXT        NOT NULL,
    negocio    TEXT,
    telefono   TEXT        NOT NULL,
    email      TEXT,
    nota       TEXT,
    estado     TEXT        NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),
    origen     TEXT        NOT NULL DEFAULT 'web',
    creada     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Una hora solo puede tener UNA cita activa. Lo garantiza la base de datos,
  -- así que es imposible reservar dos veces el mismo hueco aunque dos clientes
  -- pulsen "Solicitar" en el mismo segundo.
  CREATE UNIQUE INDEX IF NOT EXISTS citas_hueco_unico
    ON citas (fecha, hora) WHERE estado <> 'cancelada';

  -- Huecos que Nadia cierra a mano desde el panel (no se ofrecen en la web)
  CREATE TABLE IF NOT EXISTS bloqueos (
    fecha DATE NOT NULL,
    hora  TIME NOT NULL,
    PRIMARY KEY (fecha, hora)
  );

  -- WhatsApp: una fila por cliente que escribe al número del negocio.
  -- "paso" y "datos" guardan por dónde va la conversación con el bot
  -- (por ejemplo, a mitad de una reserva).
  CREATE TABLE IF NOT EXISTS wa_chats (
    telefono        TEXT PRIMARY KEY,   -- formato internacional sin "+": 34600111222
    nombre          TEXT,               -- nombre del perfil de WhatsApp
    idioma          TEXT NOT NULL DEFAULT 'es',
    paso            TEXT,
    datos           JSONB NOT NULL DEFAULT '{}',
    modo            TEXT NOT NULL DEFAULT 'bot' CHECK (modo IN ('bot', 'humano')),
    humano_hasta    TIMESTAMPTZ,        -- mientras sea futuro, el bot no contesta
    sin_leer        INT NOT NULL DEFAULT 0,
    ultimo_entrante TIMESTAMPTZ,        -- para la ventana de 24 h de WhatsApp
    actualizado     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Historial de mensajes (entrantes y salientes). wa_id es el id que da
  -- WhatsApp: al ser UNIQUE, si Meta reenvía un mensaje no se procesa dos veces.
  CREATE TABLE IF NOT EXISTS wa_mensajes (
    id        SERIAL PRIMARY KEY,
    telefono  TEXT NOT NULL,
    autor     TEXT NOT NULL CHECK (autor IN ('cliente', 'bot', 'nadia')),
    texto     TEXT NOT NULL,
    wa_id     TEXT UNIQUE,
    creado    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS wa_mensajes_chat ON wa_mensajes (telefono, creado);
`;

let pool = null;
let esquemaListo = null;

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    const e = new Error('Falta la variable DATABASE_URL');
    e.code = 'NO_DB';
    throw e;
  }
  if (!pool) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    pool = new pg.Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: true },
      max: 1 // las funciones de Vercel son pequeñas: una conexión por instancia basta
    });
  }
  return pool;
}

function asegurarEsquema() {
  if (!esquemaListo) {
    esquemaListo = getPool().query(ESQUEMA).catch(e => { esquemaListo = null; throw e; });
  }
  return esquemaListo;
}

/** Ejecuta una consulta con parámetros ($1, $2…). Nunca se concatenan datos en el SQL. */
export async function query(texto, parametros = []) {
  await asegurarEsquema();
  return getPool().query(texto, parametros);
}
```

### 5.4 `api/_lib/horario.js` — schedule and time zone

**This is the file you edit for each client's bookable hours.**

- `HORARIO`: for each weekday (0 = Sunday … 6 = Saturday) the list of start times. A day that is missing has no bookings.
- `DIAS_VISTA`: how many days ahead clients can book. `ANTELACION_HORAS`: minimum notice.
- **Why the time zone code exists:** Vercel's servers run in **UTC**, but 16:00 in A Coruña is 14:00 or 15:00 UTC depending on summer time. `madridAUtc()` converts a Madrid date + time into the exact instant, so "12 hours of notice" is correct all year round. For a client in the Canary Islands, change `ZONA` to `'Atlantic/Canary'`.
- `huecoReservable()` is what the server uses to refuse invented hours, past dates or dates too far away.

File: `web-profesional/api/_lib/horario.js`

```js
/* =============================================================
   HORARIO DE CONSULTAS — edita aquí tu disponibilidad
   Es la única fuente de verdad: la web la pide a la API, y el
   servidor la usa para rechazar horas que no existen.
   ============================================================= */
export const HORARIO = {
  // 0 = domingo, 1 = lunes … 6 = sábado
  1: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  2: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  3: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  4: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'],
  5: ['16:00', '16:30', '17:00', '17:30', '18:00'],
  6: ['10:00', '10:30', '11:00', '11:30', '12:00']
};
export const DIAS_VISTA = 14;        // cuántos días por delante se pueden reservar
export const ANTELACION_HORAS = 12;  // antelación mínima
export const ZONA = 'Europe/Madrid'; // las horas son siempre hora de A Coruña

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const esFecha = f => typeof f === 'string' && RE_FECHA.test(f) && !Number.isNaN(Date.parse(f + 'T00:00:00Z'));
export const esHora = h => typeof h === 'string' && RE_HORA.test(h);

/* El servidor de Vercel funciona en hora UTC; estas funciones traducen
   entre UTC y la hora de Madrid (incluido el cambio de horario). */
function partesEnZona(ms) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  return Object.fromEntries(f.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
}

/** "2026-10-06" + "16:30" (hora de Madrid) → milisegundos UTC */
export function madridAUtc(fecha, hora) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const supuesto = Date.UTC(y, m - 1, d, h, mi);
  const p = partesEnZona(supuesto);
  const visto = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return supuesto - (visto - supuesto); // corrige la diferencia horaria
}

/** Fecha de hoy en Madrid, "AAAA-MM-DD" */
export function hoyMadrid(ahora = Date.now()) {
  const p = partesEnZona(ahora);
  return `${p.year}-${p.month}-${p.day}`;
}

export function sumarDias(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function diaSemana(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const horasDelDia = fecha => HORARIO[diaSemana(fecha)] || [];

/** ¿Se puede reservar este hueco desde la web? (existe, está en plazo y con antelación) */
export function huecoReservable(fecha, hora, ahora = Date.now()) {
  if (!esFecha(fecha) || !esHora(hora)) return false;
  const hoy = hoyMadrid(ahora);
  if (fecha < hoy || fecha > sumarDias(hoy, DIAS_VISTA)) return false;
  if (!horasDelDia(fecha).includes(hora)) return false;
  return madridAUtc(fecha, hora) > ahora + ANTELACION_HORAS * 3600e3;
}
```

### 5.5 `api/_lib/http.js` — request/response helpers

- `enviar()` answers JSON with `Cache-Control: no-store` (bookings must never be cached).
- `permitir()` answers **405** if the method is wrong.
- `esJson()`: every request that **changes** data must be `Content-Type: application/json`. A malicious website cannot send that content type with a plain HTML form, which protects the panel against **CSRF** attacks together with the `SameSite=Strict` cookie.
- `fallo()`: a missing database answers a clear **503** (the website then falls back to email); other errors are logged (visible in Vercel → Logs) and the user gets a generic message without internal details.
- `texto()` trims and limits the length of every text field.

File: `web-profesional/api/_lib/http.js`

```js
/* =============================================================
   Utilidades HTTP comunes a todas las funciones de la API
   (solo Node, para que funcionen igual en Vercel y en local)
   ============================================================= */

/** Responde en JSON y evita que el navegador guarde la respuesta en caché */
export function enviar(res, estado, datos) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}

/** Corta la petición si el método no está permitido */
export function permitir(req, res, metodos) {
  if (metodos.includes(req.method)) return true;
  res.setHeader('Allow', metodos.join(', '));
  enviar(res, 405, { error: 'Método no permitido' });
  return false;
}

/** Parámetros de la URL (?desde=…&hasta=…) */
export const parametros = req => new URL(req.url, 'http://localhost').searchParams;

/** Cuerpo JSON de la petición (Vercel ya lo convierte; por si llega como texto) */
export function cuerpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return {};
}

/** Cuerpo SIN procesar, tal cual llega (hace falta para comprobar firmas).
    La función debe exportar config = { api: { bodyParser: false } }. */
export async function cuerpoCrudo(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const trozos = [];
  for await (const t of req) trozos.push(typeof t === 'string' ? Buffer.from(t) : t);
  return Buffer.concat(trozos);
}

/** Las peticiones que cambian datos deben ser JSON (protege contra formularios de otras webs) */
export const esJson = req => (req.headers['content-type'] || '').includes('application/json');

export function leerCookie(req, nombre) {
  const cookies = req.headers.cookie || '';
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Errores: mensaje claro si falta la base de datos, genérico en el resto */
export function fallo(res, e) {
  if (e && e.code === 'NO_DB') return enviar(res, 503, { error: 'La base de datos aún no está configurada.' });
  console.error(e);
  enviar(res, 500, { error: 'Error interno. Inténtalo de nuevo.' });
}

/** Limpia un texto del usuario: quita espacios y lo recorta */
export const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
```

### 5.6 `api/_lib/auth.js` — password and session (no libraries)

How login works:

1. The password is **only** in the `ADMIN_PASSWORD` environment variable (minimum 10 characters).
2. Comparison uses `crypto.timingSafeEqual` on SHA-256 hashes. It always takes the same time, so an attacker can't guess the password from how long the answer takes.
3. If it is correct, the server creates a **token**: `data.signature`.
   - `data` = `{ exp: expiry }` in base64.
   - `signature` = **HMAC-SHA256** of `data` with a key derived from the password.
   - Only someone who knows the password can produce a valid signature; changing the expiry breaks it.
4. The token goes into a cookie with:
   - `HttpOnly`: page JavaScript can't read it, which protects against XSS stealing the session.
   - `Secure`: HTTPS only.
   - `SameSite=Strict`: never sent from other websites.
   - `Max-Age`: 7 days.
5. **Changing `ADMIN_PASSWORD` logs out every open session**, because the signing key changes.

File: `web-profesional/api/_lib/auth.js`

```js
/* =============================================================
   Acceso al panel (/admin)
   - La contraseña está en la variable de entorno ADMIN_PASSWORD
     (en Vercel, nunca en el código ni en GitHub).
   - Al entrar se guarda una cookie con un "token" firmado:
       datos (caducidad) + firma HMAC hecha con la contraseña.
     Si alguien cambia los datos, la firma deja de coincidir.
     Si cambias la contraseña, todas las sesiones se cierran.
   Solo usa el módulo crypto que trae Node: sin librerías.
   ============================================================= */
import crypto from 'node:crypto';
import { leerCookie } from './http.js';

const COOKIE = 'lagoa_admin';
const DURACION = 7 * 24 * 3600; // la sesión dura 7 días
const MIN_LONGITUD = 10;

const sha256 = texto => crypto.createHash('sha256').update(String(texto)).digest();

/** null si no hay contraseña configurada (o es demasiado corta) */
function claveFirma() {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || p.length < MIN_LONGITUD) return null;
  return sha256('lagoa-sesion:' + p);
}

export const passwordConfigurada = () => claveFirma() !== null;

/** Compara en tiempo constante (no da pistas por lo que tarda en responder) */
export function passwordCorrecta(intento) {
  if (!passwordConfigurada()) return false;
  return crypto.timingSafeEqual(sha256(intento), sha256(process.env.ADMIN_PASSWORD));
}

const firmar = datos => crypto.createHmac('sha256', claveFirma()).update(datos).digest('base64url');

export function crearToken() {
  const datos = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + DURACION })).toString('base64url');
  return `${datos}.${firmar(datos)}`;
}

export function tokenValido(token) {
  if (!token || !passwordConfigurada()) return false;
  const [datos, firma] = token.split('.');
  if (!datos || !firma) return false;
  const a = Buffer.from(firma), b = Buffer.from(firmar(datos));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(datos, 'base64url').toString()).exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

// HttpOnly: el JavaScript de la página no puede leerla.
// SameSite=Strict: otra web no puede usar tu sesión.
export const cookieSesion = token => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION}`;
export const cookieBorrada = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export const sesionActiva = req => tokenValido(leerCookie(req, COOKIE));
```

### 5.7 `api/disponibilidad.js` — public: taken hours

Returns the schedule plus a list of `"YYYY-MM-DD HH:MM"` strings that are taken (bookings that aren't cancelled, plus blocks). **It never returns names or phones**: it is public.

`to_char(...)` formats dates as text in SQL so there are no time-zone surprises when they reach JavaScript.

File: `web-profesional/api/disponibilidad.js`

```js
/* =============================================================
   GET /api/disponibilidad  (pública)
   Devuelve el horario y las horas ya ocupadas de los próximos días.
   Solo fecha y hora: nunca datos de otros clientes.
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, fallo } from './_lib/http.js';
import { HORARIO, DIAS_VISTA, ANTELACION_HORAS, hoyMadrid, sumarDias } from './_lib/horario.js';

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET'])) return;
  const hoy = hoyMadrid();
  const hasta = sumarDias(hoy, DIAS_VISTA);
  try {
    const { rows } = await query(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora
         FROM citas WHERE estado <> 'cancelada' AND fecha BETWEEN $1 AND $2
       UNION
       SELECT to_char(fecha, 'YYYY-MM-DD'), to_char(hora, 'HH24:MI')
         FROM bloqueos WHERE fecha BETWEEN $1 AND $2`,
      [hoy, hasta]
    );
    enviar(res, 200, {
      horario: HORARIO,
      diasVista: DIAS_VISTA,
      antelacionHoras: ANTELACION_HORAS,
      ocupados: rows.map(r => `${r.fecha} ${r.hora}`)
    });
  } catch (e) {
    fallo(res, e);
  }
}
```

### 5.8 `api/reservas.js` — public: save a booking

Order of checks:

1. Method POST and JSON body.
2. **Honeypot**: if the invisible `_honey` field has text, it is a robot. We answer "OK" so it doesn't try again, but save nothing.
3. **Validation**: real bookable slot (`huecoReservable`), allowed modality, name, phone format, optional email format, privacy accepted (`=== true`).
4. `guardarCita()` from `api/_lib/citas.js` (shared with the WhatsApp bot, see 13.5) does the rest:
   - slot not blocked by the owner → otherwise 409;
   - **anti-abuse:** at most 2 future active bookings per phone. It compares the **last 9 digits**, so `+34 600 111 222`, `600-111-222` and `600111222` are the same person → otherwise 429;
   - `INSERT`. If Postgres raises error **23505** (unique violation), someone took the hour first → **409** with a friendly message.

**To add a field for a client** (for example "servicio"):

1. Add the column to the `CREATE TABLE` in `db.js`. For an existing database, run once in the Neon SQL editor: `ALTER TABLE citas ADD COLUMN servicio TEXT;`
2. Read and validate it here (`texto(b.servicio, 80)`) and add it to the `INSERT` inside `guardarCita()` in `api/_lib/citas.js`.
3. Send it from `guardarEnAgenda()` in `index.html`.
4. Return it in `CAMPOS` in `api/admin/citas.js` and show it in `tarjetaCita()` in the panel.

File: `web-profesional/api/reservas.js`

```js
/* =============================================================
   POST /api/reservas  (pública)
   Guarda la solicitud de consulta de un cliente. Antes valida todo
   en el servidor: lo que llega del navegador nunca es de fiar.
   ============================================================= */
import { enviar, permitir, cuerpo, esJson, fallo, texto } from './_lib/http.js';
import { huecoReservable } from './_lib/horario.js';
import { MODALIDADES, guardarCita } from './_lib/citas.js';

const MENSAJES = {
  ocupada: 'Esa hora ya no está disponible. Elige otra, por favor.',
  recien_ocupada: 'Esa hora se acaba de ocupar. Elige otra, por favor.',
  limite: 'Ya tienes citas pendientes con este teléfono. Si necesitas otra, escríbeme por WhatsApp.'
};

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  const b = cuerpo(req);
  if (!b) return enviar(res, 400, { error: 'Datos no válidos.' });

  // Campo trampa invisible: si un robot lo rellena, fingimos que ha ido bien
  if (b._honey) return enviar(res, 201, { ok: true });

  const d = {
    fecha: texto(b.fecha, 10),
    hora: texto(b.hora, 5),
    modalidad: texto(b.modalidad, 60),
    nombre: texto(b.nombre, 100),
    negocio: texto(b.negocio, 120),
    telefono: texto(b.telefono, 30),
    email: texto(b.email, 160),
    nota: texto(b.nota, 1000)
  };

  const errores = [];
  if (!huecoReservable(d.fecha, d.hora)) errores.push('La fecha u hora elegida no está disponible.');
  if (!MODALIDADES.includes(d.modalidad)) errores.push('La modalidad no es válida.');
  if (!d.nombre) errores.push('Falta el nombre.');
  if (!/^\+?[\d\s().-]{6,}$/.test(d.telefono)) errores.push('El teléfono no es válido.');
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errores.push('El email no es válido.');
  if (b.privacidad !== true) errores.push('Debes aceptar la política de privacidad.');
  if (errores.length) return enviar(res, 400, { error: errores.join(' ') });

  try {
    // Las reglas (hora bloqueada, máximo de citas por teléfono, una cita por hora) están en _lib/citas.js
    const r = await guardarCita(d, 'web');
    if (r.estado === 201) return enviar(res, 201, { ok: true, id: r.id });
    enviar(res, r.estado, { error: MENSAJES[r.motivo] });
  } catch (e) {
    fallo(res, e);
  }
}
```

### 5.9 Login, logout and session

- `POST /api/admin/login` `{ password }` → sets the cookie. A wrong password waits 0.8 s, which slows down brute-force attacks.
- `POST /api/admin/logout` → deletes the cookie (`Max-Age=0`).
- `GET /api/admin/sesion` → `{ activa, configurada }`. The panel uses it on load to decide whether to show the login.

File: `web-profesional/api/admin/login.js`

```js
/* =============================================================
   POST /api/admin/login  { password }
   Si la contraseña es correcta, guarda la cookie de sesión.
   ============================================================= */
import { enviar, permitir, cuerpo, esJson } from '../_lib/http.js';
import { passwordConfigurada, passwordCorrecta, crearToken, cookieSesion } from '../_lib/auth.js';

const espera = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
  if (!passwordConfigurada()) {
    return enviar(res, 503, { error: 'Falta configurar ADMIN_PASSWORD (mínimo 10 caracteres) en Vercel.' });
  }
  const { password } = cuerpo(req) || {};
  if (!passwordCorrecta(password || '')) {
    await espera(800); // frena a quien intente adivinarla probando muchas
    return enviar(res, 401, { error: 'Contraseña incorrecta.' });
  }
  res.setHeader('Set-Cookie', cookieSesion(crearToken()));
  enviar(res, 200, { ok: true });
}
```

File: `web-profesional/api/admin/logout.js`

```js
/* POST /api/admin/logout — borra la cookie de sesión */
import { enviar, permitir } from '../_lib/http.js';
import { cookieBorrada } from '../_lib/auth.js';

export default function handler(req, res) {
  if (!permitir(req, res, ['POST'])) return;
  res.setHeader('Set-Cookie', cookieBorrada());
  enviar(res, 200, { ok: true });
}
```

File: `web-profesional/api/admin/sesion.js`

```js
/* GET /api/admin/sesion — ¿hay sesión abierta? (el panel lo usa al cargar) */
import { enviar, permitir } from '../_lib/http.js';
import { sesionActiva, passwordConfigurada } from '../_lib/auth.js';

export default function handler(req, res) {
  if (!permitir(req, res, ['GET'])) return;
  enviar(res, 200, { activa: sesionActiva(req), configurada: passwordConfigurada() });
}
```

### 5.10 `api/admin/citas.js` — private: list, add, change status

Every request first checks `sesionActiva(req)` → **401** if not logged in.

- **GET** `?desde=&hasta=` → bookings of that range, blocks, the schedule and the number of pending bookings. Dates are validated with a regular expression, so text like `' OR 1=1 --` is simply ignored. Maximum 3 months per request.
- **POST** → booking added by hand (phone calls, walk-ins). It is created already `confirmada` with `origen = 'panel'`, can be outside the normal schedule, and removes a block on that slot if there was one.
- **PATCH** `{ id, estado }` → confirm, cancel or reactivate. Reactivating a booking whose hour is already taken fails with **409** (the unique index again).

File: `web-profesional/api/admin/citas.js`

```js
/* =============================================================
   /api/admin/citas  (solo con sesión)
   GET   ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD → citas, bloqueos y horario
   POST  { fecha, hora, nombre, telefono, … } → cita añadida a mano
   PATCH { id, estado }                      → confirmar / cancelar / reactivar
   ============================================================= */
import { query } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo, texto } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { HORARIO, esFecha, esHora, hoyMadrid, sumarDias } from '../_lib/horario.js';

const ESTADOS = ['pendiente', 'confirmada', 'cancelada'];
const CAMPOS = `id, to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora,
  modalidad, nombre, negocio, telefono, email, nota, estado, origen, creada`;

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET', 'POST', 'PATCH'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  if (req.method !== 'GET' && !esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });

  try {
    if (req.method === 'GET') return await listar(req, res);
    if (req.method === 'POST') return await crear(req, res);
    return await cambiarEstado(req, res);
  } catch (e) {
    if (e.code === '23505') return enviar(res, 409, { error: 'Ya hay otra cita activa a esa hora.' });
    fallo(res, e);
  }
}

async function listar(req, res) {
  const p = parametros(req);
  const hoy = hoyMadrid();
  let desde = p.get('desde'), hasta = p.get('hasta');
  if (!esFecha(desde)) desde = hoy;
  if (!esFecha(hasta) || hasta < desde) hasta = sumarDias(desde, 6);
  if (hasta > sumarDias(desde, 92)) hasta = sumarDias(desde, 92); // como mucho 3 meses de golpe

  const citas = await query(`SELECT ${CAMPOS} FROM citas WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha, hora, id`, [desde, hasta]);
  const bloqueos = await query(
    `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora
       FROM bloqueos WHERE fecha BETWEEN $1 AND $2`, [desde, hasta]);
  const pendientes = await query(
    `SELECT count(*)::int AS n FROM citas WHERE estado = 'pendiente' AND fecha >= $1`, [hoy]);

  enviar(res, 200, {
    desde, hasta, hoy,
    horario: HORARIO,
    citas: citas.rows,
    bloqueos: bloqueos.rows.map(r => `${r.fecha} ${r.hora}`),
    pendientesTotal: pendientes.rows[0].n
  });
}

async function crear(req, res) {
  const b = cuerpo(req) || {};
  const d = {
    fecha: texto(b.fecha, 10), hora: texto(b.hora, 5),
    nombre: texto(b.nombre, 100), negocio: texto(b.negocio, 120),
    telefono: texto(b.telefono, 30), email: texto(b.email, 160),
    modalidad: texto(b.modalidad, 60) || 'Videollamada', nota: texto(b.nota, 1000)
  };
  if (!esFecha(d.fecha) || !esHora(d.hora)) return enviar(res, 400, { error: 'Fecha u hora no válida.' });
  if (!d.nombre) return enviar(res, 400, { error: 'Falta el nombre.' });

  const { rows: [cita] } = await query(
    `INSERT INTO citas (fecha, hora, modalidad, nombre, negocio, telefono, email, nota, estado, origen)
     VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), 'confirmada', 'panel')
     RETURNING ${CAMPOS}`,
    [d.fecha, d.hora, d.modalidad, d.nombre, d.negocio, d.telefono, d.email, d.nota]
  );
  // Si ese hueco estaba bloqueado, deja de estarlo: ahora hay una cita
  await query('DELETE FROM bloqueos WHERE fecha = $1 AND hora = $2', [d.fecha, d.hora]);
  enviar(res, 201, { cita });
}

async function cambiarEstado(req, res) {
  const { id, estado } = cuerpo(req) || {};
  if (!Number.isInteger(id) || !ESTADOS.includes(estado)) return enviar(res, 400, { error: 'Datos no válidos.' });
  const { rows } = await query(`UPDATE citas SET estado = $2 WHERE id = $1 RETURNING ${CAMPOS}`, [id, estado]);
  if (!rows.length) return enviar(res, 404, { error: 'No existe esa cita.' });
  enviar(res, 200, { cita: rows[0] });
}
```

### 5.11 `api/admin/bloqueos.js` — private: close and open slots

- **POST** `{ fecha, hora }` → block (fails with 409 if there is a booking).
- **DELETE** `?fecha=&hora=` → unblock.

File: `web-profesional/api/admin/bloqueos.js`

```js
/* =============================================================
   /api/admin/bloqueos  (solo con sesión)
   POST   { fecha, hora }     → cierra un hueco (deja de ofrecerse en la web)
   DELETE ?fecha=…&hora=…     → lo vuelve a abrir
   ============================================================= */
import { query } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { esFecha, esHora } from '../_lib/horario.js';

export default async function handler(req, res) {
  if (!permitir(req, res, ['POST', 'DELETE'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });

  try {
    if (req.method === 'POST') {
      if (!esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });
      const { fecha, hora } = cuerpo(req) || {};
      if (!esFecha(fecha) || !esHora(hora)) return enviar(res, 400, { error: 'Fecha u hora no válida.' });
      const ocupada = await query(`SELECT 1 FROM citas WHERE fecha = $1 AND hora = $2 AND estado <> 'cancelada'`, [fecha, hora]);
      if (ocupada.rowCount) return enviar(res, 409, { error: 'Ese hueco ya tiene una cita.' });
      await query('INSERT INTO bloqueos (fecha, hora) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fecha, hora]);
      return enviar(res, 201, { ok: true });
    }
    const p = parametros(req);
    const fecha = p.get('fecha'), hora = p.get('hora');
    if (!esFecha(fecha) || !esHora(hora)) return enviar(res, 400, { error: 'Fecha u hora no válida.' });
    await query('DELETE FROM bloqueos WHERE fecha = $1 AND hora = $2', [fecha, hora]);
    enviar(res, 200, { ok: true });
  } catch (e) {
    fallo(res, e);
  }
}
```

### 5.12 API reference (summary)

| Method | URL | Access | Body / params | Answers |
|---|---|---|---|---|
| GET | `/api/disponibilidad` | Public | — | 200 `{horario, diasVista, antelacionHoras, ocupados[]}` · 503 |
| POST | `/api/reservas` | Public | `{fecha, hora, modalidad, nombre, negocio, telefono, email, nota, privacidad, _honey}` | 201 · 400 · 409 · 415 · 429 · 503 |
| POST | `/api/admin/login` | Public | `{password}` | 200 + cookie · 401 · 503 |
| POST | `/api/admin/logout` | Public | — | 200 |
| GET | `/api/admin/sesion` | Public | — | 200 `{activa, configurada}` |
| GET | `/api/admin/citas` | Session | `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | 200 `{citas[], bloqueos[], horario, pendientesTotal}` · 401 |
| POST | `/api/admin/citas` | Session | `{fecha, hora, nombre, telefono, negocio, email, modalidad, nota}` | 201 · 400 · 409 |
| PATCH | `/api/admin/citas` | Session | `{id, estado}` | 200 · 400 · 404 · 409 |
| POST | `/api/admin/bloqueos` | Session | `{fecha, hora}` | 201 · 400 · 409 |
| DELETE | `/api/admin/bloqueos` | Session | `?fecha=&hora=` | 200 · 400 |

---

## 6. Part 3 — The admin panel

`admin/index.html` is a separate page served at `/admin`. It has `<meta name="robots" content="noindex">` and is excluded in `robots.txt`.

> **The page itself is public, the data is not.** Anyone can open `/admin` and see an empty login screen, but every API call returns 401 without the session cookie. That is the correct design: security lives on the server, never in hiding a page.

Every function of the panel:

| Function | What it does |
|---|---|
| `hoyTexto`, `aFecha`, `sumarDias`, `lunesDe`, `minutos`, `mayuscula` | Date helpers. Dates travel as text `"YYYY-MM-DD"` to avoid time-zone bugs; `lunesDe` gives the Monday of a week |
| `api(url, {method, body})` | Every call to the backend: sends JSON, includes the cookie, and on **401** returns to the login screen automatically |
| `aviso(text, error)` | Small floating message ("Cita confirmada") |
| `mostrarLogin()` / `mostrarAgenda()` | Switch between the two views |
| Login form handler | `POST /api/admin/login`, shows the error if wrong |
| Logout button | `POST /api/admin/logout` |
| `cargar()` | `GET /api/admin/citas` for the visible week |
| `pintar()` | Draws the 7 days: bookings first, blocked slots, free hours folded inside "N horas libres", cancelled ones inside "N canceladas", plus the pending notice |
| `filaHueco()` | A free or blocked slot row with "+ Cita", "Bloquear" or "Abrir" |
| `tarjetaCita()` | A booking card: time, name, business, status, modality, phone (tap to call), email, note, buttons Confirmar / WhatsApp / Cancelar / Reactivar |
| `telefonoWa()` | Cleans a phone for `wa.me` (adds `34` to 9-digit Spanish numbers) |
| `accion()` | Runs any action, shows the result and reloads the week |
| `bloquearVarios()` | "Bloquear día": blocks every free hour of a day |
| `abrirNueva()` + form handler | Dialog to add a booking by hand |
| Week buttons ← Hoy → | Move between weeks |
| `inicio()` | On load: checks `/api/admin/sesion` and shows login or agenda; warns if `ADMIN_PASSWORD` is missing |
| `setInterval` + `visibilitychange` | Refreshes every minute and when you come back to the tab |

The **WhatsApp tab** (conversations, replies, pause/resume the bot) is explained in section 13.5.

To adapt for a client: the WhatsApp confirmation text inside `tarjetaCita()` (it signs "Nadia · Lagoa"), the colours in `:root`, the title, and the modalities list in the "Nueva cita" dialog (they must match `MODALIDADES` in `api/_lib/citas.js`).

---

## 7. Part 4 — Testing on your computer

Never test against a client's real database. Use a local Postgres.

### 7.1 Install and start a local Postgres

- **Windows:** install from https://www.postgresql.org/download/windows/ (remember the `postgres` password). Open "SQL Shell (psql)".
- **macOS:** `brew install postgresql@16 && brew services start postgresql@16`.
- **Linux (Debian/Ubuntu):** `sudo apt install postgresql && sudo service postgresql start`.

Create a test database:

```bash
psql -U postgres -c "CREATE DATABASE lagoa_test;"
```

Your local `DATABASE_URL` will be something like `postgres://postgres:YOURPASSWORD@localhost:5432/lagoa_test`.

### 7.2 Install dependencies and start the local server

From the **repository root**:

```bash
cd web-profesional && npm install && cd ..

# macOS / Linux
DATABASE_URL=postgres://postgres:YOURPASSWORD@localhost:5432/lagoa_test \
ADMIN_PASSWORD=una-clave-de-prueba \
node tools/dev-server.mjs web-profesional

# Windows (PowerShell)
$env:DATABASE_URL="postgres://postgres:YOURPASSWORD@localhost:5432/lagoa_test"
$env:ADMIN_PASSWORD="una-clave-de-prueba"
node tools/dev-server.mjs web-profesional
```

Open http://localhost:3077 (the website) and http://localhost:3077/admin (the panel).

> **Why not `vercel dev`?** It also works (`npm i -g vercel`, `vercel link`, `vercel env pull`, `vercel dev`), but it needs your Vercel account and can download the real environment variables. `tools/dev-server.mjs` is ~70 lines you can read and understand, and it can't touch production by accident.

File: `tools/dev-server.mjs`

```js
// =============================================================
// Local server that imitates Vercel: serves the static files and
// runs the functions in /api exactly like Vercel does.
//
// Usage (from the repository root):
//   DATABASE_URL=postgres://postgres@127.0.0.1:5432/lagoa \
//   ADMIN_PASSWORD=a-long-test-password \
//   node tools/dev-server.mjs web-profesional
// Then open http://localhost:3077 and http://localhost:3077/admin
// =============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || 'web-profesional');
const PORT = Number(process.env.PORT || 3077);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json'
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // /api/... → run the matching function file (files and folders starting with _ are private)
  if (url.pathname.startsWith('/api/')) {
    const rel = url.pathname.replace(/\/$/, '');
    let file = path.join(ROOT, rel + '.js');
    if (!fs.existsSync(file)) file = path.join(ROOT, rel, 'index.js');
    if (!fs.existsSync(file) || rel.split('/').some(p => p.startsWith('_'))) {
      res.statusCode = 404;
      return res.end('{"error":"Not found"}');
    }
    try {
      const mod = await import(pathToFileURL(file).href);
      // Like Vercel: parse the body, unless the function asks for the raw stream
      if (mod.config?.api?.bodyParser !== false) {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        if ((req.headers['content-type'] || '').includes('application/json') && raw) {
          try { req.body = JSON.parse(raw); } catch { req.body = raw; }
        } else {
          req.body = raw || undefined;
        }
      }
      await mod.default(req, res);
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end('{"error":"Function crashed (see terminal)"}');
    }
    return;
  }

  // Anything else → static file (folders serve their index.html)
  let p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}  (root: ${ROOT})`));
```

### 7.3 Run the automatic API tests

In a second terminal, with the server running:

```bash
psql "postgres://postgres:YOURPASSWORD@localhost:5432/lagoa_test" -c "TRUNCATE citas, bloqueos RESTART IDENTITY;"
ADMIN_PASSWORD=una-clave-de-prueba node tools/api-test.mjs
```

**All 38 lines must start with `OK`.** They cover:

- **Bookings:** valid bookings, double booking, invented hours, past dates, missing privacy consent, invalid phone, honeypot, wrong content type and method.
- **Data protection:** availability doesn't leak personal data.
- **Limits:** the per-phone limit with different formats, and 6 simultaneous bookings for the same hour (only 1 saved).
- **Login:** wrong password with delay, cookie flags, tampered and forged cookies.
- **Panel:** confirm, invented status, block/unblock, cancel frees the slot, reactivate conflict, manual bookings.
- **Attacks:** CSRF without JSON, SQL injection in params and names, logout.

Run them **every time you change the backend**, before deploying. The WhatsApp bot has its own 49 tests: section 13.6.

### 7.4 Manual checklist (browser)

- [ ] Website at 360 px and 1280 px: nothing overflows sideways, nothing covered by the chat button.
- [ ] Book an hour → success message → the hour disappears after reloading.
- [ ] Open two tabs, pick the same hour in both, send both → the second one gets "Esa hora se acaba de ocupar".
- [ ] Stop the server and book → the form falls back to email (FormSubmit).
- [ ] `/admin`: wrong password → error; right password → agenda.
- [ ] Confirm, WhatsApp button (opens with text), block an hour (disappears from the website), add a booking by hand, cancel (hour comes back), log out.
- [ ] DevTools → Console: no red errors from your code (failed font loads don't matter).
- [ ] Keyboard only (Tab, Enter, arrows): you can book without a mouse.

---

## 8. Part 5 — Publishing on Vercel

### 8.1 Push to GitHub

```bash
git add -A
git commit -m "Client website with bookings"
git push origin main
```

### 8.2 Create the project **connected to GitHub** (important)

1. vercel.com → **Add New… → Project** → **Import** the client's repository.
   - If it isn't listed: **Adjust GitHub App Permissions** and give Vercel access to it.
2. **Framework Preset:** `Other`. No build command, no output directory.
3. **Root Directory:** the folder that contains `index.html`, `api/` and `package.json` (here `web-profesional`).
4. **Deploy.**

> ⚠️ **Lesson learned:** a project created without connecting GitHub doesn't update when you push, and **"Redeploy" re-publishes the *same old commit*, not your latest code.** If the site doesn't change after a push, check **Settings → Git**: a repository must be connected and the **Production Branch** must be the branch you push to (Settings → Environments → Production → Branch Tracking).

### 8.3 Create the database (Neon)

1. Project → **Storage** → **Create Database** → **Neon** (Serverless Postgres) → free plan.
2. **Region: Frankfurt (eu-central-1)** for Spanish clients (GDPR; data stays in the EU, faster).
3. **Connect** it to the project (Production, Preview and Development). Vercel adds `DATABASE_URL` (plus a few other variables we don't use).

### 8.4 Environment variables

Project → **Settings → Environment Variables**:

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | (created by Neon) | Don't touch |
| `ADMIN_PASSWORD` | Long password, ≥ 10 characters | The **client** chooses it; you don't need to know it. A phrase like `pan-de-millo-con-75-pasas` is good |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | From Meta (section 13.3) | Only if the client has the WhatsApp bot. **Never** set `WHATSAPP_API_URL` in Vercel (it's only for tests) |

**After adding or changing variables you must redeploy** (Deployments → ⋯ → Redeploy). Variables only reach new deployments.

### 8.5 Domain

Settings → **Domains** → add `www.client.com` and follow the DNS instructions (an `A` record or a `CNAME`). HTTPS is automatic. Then update `canonical`, `og:url`, `og:image`, JSON-LD `url`, `sitemap.xml` and `robots.txt`.

> If you rename the project or its `*.vercel.app` domain, the old address stops working. Search the code for the old domain and replace it (this happened with `nadialavi.vercel.app` → `lagoa-webs.vercel.app`).

### 8.6 Final check in production

- [ ] `https://DOMAIN/api/disponibilidad` returns JSON with `ocupados` (not "La base de datos aún no está configurada").
- [ ] `https://DOMAIN/api/admin/sesion` returns `"configurada": true`.
- [ ] `https://DOMAIN/api/_lib/auth.js` returns **404** (private code isn't published).
- [ ] Make a real booking with your phone → it appears in `/admin` → confirm → cancel.
- [ ] Activation email from FormSubmit clicked.
- [ ] Share the link on WhatsApp: the preview shows the right photo and title.
- [ ] Google Search Console: property added, sitemap submitted.

---

## 9. Part 6 — Handing it over to the client

**Who owns the accounts?** Two options; agree it in writing in the quote:

1. **Client owns everything** (recommended when they pay for the project): create GitHub, Vercel and domain under the client's email, and add yourself as a collaborator/member. "Todo queda a tu nombre" is literally true.
2. **You host it** under your Vercel team and charge maintenance. Easier for you, but explain it to the client.

**Give the client:**

- The panel link (`/admin`) and how to change the password (in Vercel, or ask you).
- A one-page guide: the yellow chip means pending (confirm or call), green means confirmed; how to block holidays ("Bloquear día"); how to add a phone booking ("+ Nueva cita").
- How they receive warnings (email from FormSubmit) and how often to check the panel.
- What maintenance includes (your 15–29 €/month plan): backups, updates, small changes.

**Recommend to the client:** add `/admin` to the phone's home screen (Safari/Chrome → Share → "Add to Home Screen"), so it opens like an app.

---

## 10. Maintenance and troubleshooting

### 10.1 Everyday changes

| Change | Where |
|---|---|
| Bookable hours, days ahead, notice | `api/_lib/horario.js` → push |
| Prices | `SERVICES`/`PACK` in `index.html` **and** the fixed texts of the service cards + JSON-LD **and** `api/_lib/negocio.js` (WhatsApp bot) |
| Bot answers | `T` and `CLAVES` in `api/_lib/bot.js` → run `tools/whatsapp-test.mjs` → push |
| Texts, photos | `index.html`, `img/` |
| Panel password | Vercel → Environment Variables → `ADMIN_PASSWORD` → Redeploy |
| Close a holiday | Panel → "Bloquear día" (no code) |

### 10.2 Looking at the data directly (Neon SQL editor)

Vercel → Storage → your database → **Open in Neon** → SQL Editor. Useful queries:

```sql
-- Next bookings
SELECT fecha, hora, nombre, telefono, estado FROM citas
WHERE fecha >= current_date ORDER BY fecha, hora;

-- How many bookings per month
SELECT to_char(fecha, 'YYYY-MM') AS mes, count(*) FROM citas
WHERE estado <> 'cancelada' GROUP BY 1 ORDER BY 1;

-- Delete a client's data (GDPR deletion request)
DELETE FROM citas WHERE telefono LIKE '%600111222%';
DELETE FROM wa_mensajes WHERE telefono LIKE '%600111222';
DELETE FROM wa_chats WHERE telefono LIKE '%600111222';

-- WhatsApp: who talked to the bot this month, and how many messages
SELECT c.nombre, c.telefono, count(*) FROM wa_mensajes m JOIN wa_chats c USING (telefono)
WHERE m.creado > date_trunc('month', now()) GROUP BY 1, 2 ORDER BY 3 DESC;

-- Delete old bookings (for example, older than 2 years)
DELETE FROM citas WHERE fecha < current_date - interval '2 years';
```

### 10.3 Backups

- Neon keeps a short **history** you can restore from (Neon console → Branches / Restore; how many days depends on the plan).
- For your own copy: `pg_dump "DATABASE_URL" > backup-2026-10.sql` (copy `DATABASE_URL` from Vercel; keep the file private, it contains personal data).

### 10.4 Problems and solutions

| Symptom | Probable cause | Fix |
|---|---|---|
| Site doesn't change after push | Project not connected to Git, wrong production branch, or used "Redeploy" | 8.2; push again or deploy the latest commit |
| Photos don't show in production but do locally | Upper/lowercase in file names, or file not committed | Same exact name in HTML and file; `git status` |
| `/api/...` gives 404 | Root Directory wrong, or file not in `api/` | Settings → General → Root Directory |
| "La base de datos aún no está configurada" (503) | `DATABASE_URL` missing, or no redeploy after adding it | 8.3 + Redeploy |
| Panel: "Falta configurar ADMIN_PASSWORD" | Variable missing or shorter than 10 characters | 8.4 + Redeploy |
| Error 500 | Bug or database problem | Vercel → project → **Logs**: read the `console.error` |
| No emails arrive | FormSubmit not activated, or in spam | Click the activation email; mark as "not spam" |
| Hour shows as free but booking fails with 409 | Someone booked it meanwhile | Normal; the form refreshes the hours |
| Logged out unexpectedly | Session expired (7 days) or password changed | Log in again |
| Wrong hours in summer/winter | Time zone | Check `ZONA` in `horario.js` |

---

## 11. Security checklist

Before every delivery:

- [ ] No password, token or `DATABASE_URL` in the code or on GitHub (`git log -p | grep -i password` shows nothing real).
- [ ] `ADMIN_PASSWORD` ≥ 10 characters, chosen by the client, not reused.
- [ ] Every SQL query uses `$1, $2…` parameters.
- [ ] Every public endpoint validates on the server (never trusts the form).
- [ ] Endpoints that change data require JSON (`esJson`) and, if private, a session (`sesionActiva`).
- [ ] Public endpoints return no personal data.
- [ ] `/admin` and `/api` excluded in `robots.txt`; panel has `noindex`.
- [ ] `api/_lib/...` returns 404 in production.
- [ ] `node tools/api-test.mjs`: 38/38 OK.
- [ ] Privacy policy names every provider (Vercel, Neon, FormSubmit, Meta) and the owner's details, and (with the bot) that WhatsApp messages are stored and deleted after 6 months.
- [ ] WhatsApp bot: `node tools/whatsapp-test.mjs`: 49/49 OK; the 4 `WHATSAPP_…` variables only in Vercel; permanent token from a system user (not your personal account); `/api/whatsapp` without a valid signature returns 401.
- [ ] Neon database in an EU region.

---

## 12. Ideas to extend it

Ordered from easiest to hardest:

1. **Show the "servicio" in each booking** (hairdresser: cut, colour…): section 5.8 "To add a field".
2. **Booking duration:** a 60-minute service blocks two 30-minute slots. Store `duracion` and check overlaps in SQL.
3. **Server-side email** with Resend (https://resend.com, free tier): send the confirmation from `api/reservas.js` instead of FormSubmit, with an `RESEND_API_KEY` variable.
4. **Automatic reminders:** a **Vercel Cron Job** (`vercel.json` → `"crons"`) that runs every evening, finds tomorrow's confirmed bookings and sends an email or a WhatsApp reminder. For WhatsApp you already have the connection (section 13); the reminder must be a **template** approved in WhatsApp Manager (type *utility*), sent with `type: 'template'` instead of `text`.
5. **Google Calendar sync** with the `googleapis` library and a service account: each confirmed booking also appears in the owner's calendar.
6. **Several employees:** add a `profesional` column and include it in the unique index `(fecha, hora, profesional)`.
7. **Client self-cancellation:** a secret link per booking (random token stored in the table) that lets the client cancel without logging in.
8. **Turn it into a product:** one codebase for all your clients, where each client's texts and hours come from a configuration file. That's the step from "a website" to "your own booking software".

---

## 13. Part 7 — The WhatsApp bot

A real bot **inside WhatsApp**: when someone writes to the business number, the bot answers at once. It shows a menu, answers questions about services, prices and timings, books a consultation in **the same agenda as the website**, lets the client see or cancel their bookings, and passes the chat to the owner when the client asks for a person. The owner answers from the **WhatsApp tab of the panel**.

It's optional: if the `WHATSAPP_…` variables aren't set, nothing changes (the webhook answers 503 and the panel says "WhatsApp aún no está conectado").

### 13.1 How it travels

```
CLIENT (WhatsApp app)        META (WhatsApp Cloud API)            VERCEL                              NEON
─────────────────────        ─────────────────────────            ──────                              ────
Writes "Hola" ─────────────▶ receives it and calls your webhook ─POST /api/whatsapp─▶ 1. checks Meta's signature
                             (signed with your App secret)                          2. saves the message ──▶ wa_mensajes
                                                                                    3. reads the chat state ─▶ wa_chats
                                                                                    4. bot decides the answer
Sees the answer ◀──────────── delivers it ◀── POST graph.facebook.com/…/messages ─── 5. sends it (+ saves it)
                                                                                    6. saves the new state ──▶ wa_chats
Books a slot ─────────────── same path ─────────────────────────────────────────▶ guardarCita() ─────────▶ citas

OWNER (/admin → WhatsApp)
Reads chats ─────────────────GET /api/admin/whatsapp─────────────────────────────▶ wa_chats + wa_mensajes
Replies ─────────────────────POST /api/admin/whatsapp ─▶ sends through Meta, pauses the bot 24 h in that chat
```

### 13.2 Meta's rules you must know (tell the client)

| Rule | What it means in practice |
|---|---|
| **One number = API or app** | A number connected to the Cloud API normally **can't be used in the WhatsApp / WhatsApp Business app at the same time**. Use a **new number** for the business bot (a cheap SIM or a number that can receive an SMS or call to verify). Meta also offers "coexistence" for some WhatsApp Business app numbers; check Meta's current docs before promising it. The owner doesn't need the app: they answer from the panel. |
| **24-hour window** | The business can send **free-form** messages only within 24 h of the client's last message. After that, only **templates** approved by Meta (paid). The panel blocks replies outside the window and explains why. |
| **Costs** | Replies inside the 24 h window (customer service) are free. Templates (reminders, marketing) are charged per message. Prices change: check Meta's "WhatsApp Business Platform pricing" page. |
| **Test number** | Meta gives a free **test number** that can write to up to **5 phone numbers you verify**. Perfect for building and demoing. |
| **Business verification** | To use a real number, have a public display name and higher limits, Meta may ask to verify the business (documents). It can take days: start early. |
| **Message limits** | Max **3 buttons** (20 characters each), lists with max **10 options** (24-character titles), 1,024 characters of text in a message with buttons. The code trims everything (`corta()`), because Meta rejects the whole message if one part is too long. |

### 13.3 Step by step: connect a number (≈ 1 hour the first time)

Meta renames buttons often. If something isn't where described, search Meta's docs for "WhatsApp Cloud API get started"; the steps are the same.

1. **Meta Business portfolio:** https://business.facebook.com → create one for the client's business (or use theirs).
2. **App:** https://developers.facebook.com → *My Apps* → *Create app* → use case **"Connect with customers through WhatsApp"** (or type *Business*) → link it to the portfolio.
3. **API Setup** (left menu *WhatsApp → API Setup*). Here you see:
   - the **test number** and its **Phone number ID** → `WHATSAPP_PHONE_ID`
   - a **temporary token** (lasts 24 h, only for a first try)
   - *To*: **add your own phone** as a recipient and confirm the code they send you.
4. **App secret:** *App settings → Basic → App secret → Show* → `WHATSAPP_APP_SECRET`.
5. **Permanent token** (the temporary one expires): business.facebook.com → *Settings → Users → System users → Add* (role Admin) → *Assign assets*: the app (full control) and the WhatsApp account (full control) → *Generate token* → choose the app, expiration **Never**, permissions **`whatsapp_business_messaging`** and **`whatsapp_business_management`** → copy it (it's shown once) → `WHATSAPP_TOKEN`.
6. **Invent the verify token:** any long random text, e.g. `lagoa-webhook-8f3k2m9q` → `WHATSAPP_VERIFY_TOKEN`.
7. **Vercel → Settings → Environment Variables:** add the 4 variables (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`) → **Redeploy**.
8. **Webhook:** Meta → *WhatsApp → Configuration → Webhook → Edit*:
   - Callback URL: `https://YOUR-DOMAIN/api/whatsapp`
   - Verify token: the same text as `WHATSAPP_VERIFY_TOKEN`
   - *Verify and save*. Meta calls your `GET /api/whatsapp`; the code answers with the `challenge` only if the token matches.
   - Then in *Webhook fields*, **subscribe to `messages`** (without this, nothing arrives).
9. **Try it:** from your phone (the one added in step 3) send "Hola" to the test number. The bot answers with the greeting and the menu. Open `/admin → WhatsApp`: the conversation is there.
10. **Real number** (when the client is ready): *WhatsApp → API Setup → Add phone number* → display name (Meta reviews it) → verify by SMS/call → add a payment method in WhatsApp Manager (needed for templates) → copy the **new Phone number ID** into `WHATSAPP_PHONE_ID` → Redeploy. In *App settings → Basic* add the privacy policy URL `https://YOUR-DOMAIN/#privacidad` and switch the app to **Live**.
11. **Website:** change `CONFIG.whatsapp` in `index.html` to the new number, so every "WhatsApp" button on the site opens the bot.

### 13.4 The design decisions (and why)

- **Signature check (`firmaValida`)**: the webhook URL is public, so anyone could POST fake messages. Meta signs each request with HMAC-SHA256 using the App secret; we recompute it over the **raw body** and compare with `timingSafeEqual`. That's why `api/whatsapp.js` exports `config = { api: { bodyParser: false } }`: if Vercel parsed the JSON first, the bytes could change and the signature would never match.
- **No duplicate answers:** Meta can deliver the same message twice. `wa_mensajes.wa_id` is `UNIQUE` and the insert uses `ON CONFLICT DO NOTHING`: if nothing was inserted, we already handled it.
- **Always answer 200** to Meta (after logging errors): if the webhook answers with an error, Meta keeps retrying for days.
- **Conversation state in the database** (`wa_chats.paso` + `datos`): functions don't remember anything between calls, so "this client is choosing an hour for Tuesday" must be stored. A booking left half-done for 2 hours is forgotten (`MINUTOS_PASO`).
- **Buttons carry ids** (`tema:precios`, `dia:2026-10-07`, `hora:16:30`, `anular:12`): the bot never guesses from the button text, so translations or typos don't break anything.
- **Same rules as the website:** both call `guardarCita()` in `api/_lib/citas.js` (blocked slots, max 2 future bookings per phone, unique index → no double bookings). One place to change the rules.
- **Handover:** "Hablar con Nadia" (or writing "hablar con una persona") sets `modo = 'humano'` for 24 h: the bot stays quiet and the panel shows "Te espera". The client can write "menú" to get the bot back; the owner can press "Devolver al bot".
- **Clients can cancel only their own bookings:** the query checks that the last 9 digits of the phone match.
- **Privacy:** messages older than 180 days are deleted (`DIAS_HISTORIAL`), and the privacy policy says so.

The conversation, step by step:

| `paso` | The bot just asked… | Accepts | Next |
|---|---|---|---|
| `null` | nothing (free chat) | text (keywords) or any `tema:` button | answer + buttons |
| `modalidad` | how to meet | `mod:0/1/2` | `dia` |
| `dia` | which day (list of days with free hours) | `dia:YYYY-MM-DD` | `hora` |
| `hora` | which hour (list) | `hora:HH:MM` or `volver:dia` | `nombre` |
| `nombre` | name | text, or `nombre:perfil` (their WhatsApp name) | `negocio` |
| `negocio` | business name | text or `negocio:no` | `confirmar` |
| `confirmar` | summary + privacy link | `ok`, `volver:dia`, `tema:cancelar` | saved → `null` |

At any step, "cancelar", "menú" or "hablar con una persona" work, and so does "galego"/"castellano" to change language.

### 13.5 The files

New tables in `api/_lib/db.js` (already shown in 5.3): `wa_chats` (one row per client) and `wa_mensajes` (history).

`api/_lib/citas.js` — booking rules shared by the website and the bot:

File: `web-profesional/api/_lib/citas.js`

```js
/* =============================================================
   Guardar citas de clientes (lo usan la web y el bot de WhatsApp)
   Así las dos entradas siguen exactamente las mismas reglas.
   ============================================================= */
import { query } from './db.js';
import { hoyMadrid } from './horario.js';

export const MODALIDADES = ['Videollamada', 'Llamada de teléfono', 'En persona (solo A Coruña ciudad)'];
export const MAX_CITAS_POR_TELEFONO = 2; // citas futuras activas a la vez (frena reservas en masa)

/** Mismo número aunque se escriba distinto (+34 600…, 600-…): se comparan los 9 últimos dígitos */
export const ultimos9 = telefono => String(telefono).replace(/\D/g, '').slice(-9);

const COINCIDE_TELEFONO = `right(regexp_replace(telefono, '[^0-9]', '', 'g'), 9) = $1`;

/** Citas activas de hoy en adelante de un teléfono */
export async function citasActivasDe(telefono) {
  const { rows } = await query(
    `SELECT id, to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(hora, 'HH24:MI') AS hora, modalidad, estado
       FROM citas WHERE ${COINCIDE_TELEFONO} AND estado <> 'cancelada' AND fecha >= $2
      ORDER BY fecha, hora`,
    [ultimos9(telefono), hoyMadrid()]
  );
  return rows;
}

/** El cliente anula su propia cita (solo si el teléfono coincide) */
export async function anularCitaDe(id, telefono) {
  const { rowCount } = await query(
    `UPDATE citas SET estado = 'cancelada' WHERE id = $2 AND ${COINCIDE_TELEFONO} AND estado <> 'cancelada'`,
    [ultimos9(telefono), id]
  );
  return rowCount > 0;
}

/** Guarda una cita YA VALIDADA (fecha, hora, modalidad…).
    Devuelve { estado: 201, id } o { estado: 409 | 429, motivo } */
export async function guardarCita(d, origen = 'web') {
  const bloqueado = await query('SELECT 1 FROM bloqueos WHERE fecha = $1 AND hora = $2', [d.fecha, d.hora]);
  if (bloqueado.rowCount) return { estado: 409, motivo: 'ocupada' };

  if ((await citasActivasDe(d.telefono)).length >= MAX_CITAS_POR_TELEFONO) return { estado: 429, motivo: 'limite' };

  try {
    const { rows: [cita] } = await query(
      `INSERT INTO citas (fecha, hora, modalidad, nombre, negocio, telefono, email, nota, origen)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''), $9)
       RETURNING id`,
      [d.fecha, d.hora, d.modalidad, d.nombre, d.negocio || '', d.telefono, d.email || '', d.nota || '', origen]
    );
    return { estado: 201, id: cita.id };
  } catch (e) {
    // 23505 = la regla "una cita por hora" de la base de datos ha saltado
    if (e.code === '23505') return { estado: 409, motivo: 'recien_ocupada' };
    throw e;
  }
}
```

`api/_lib/negocio.js` — the business data the bot uses (⚠ prices are also in `index.html`):

File: `web-profesional/api/_lib/negocio.js`

```js
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
```

`api/_lib/whatsapp.js` — talks to Meta: signature check, converts our simple message format (`{texto}`, `{texto, botones}`, `{texto, lista}`) to Meta's format, sends and saves:

File: `web-profesional/api/_lib/whatsapp.js`

```js
/* =============================================================
   Conexión con WhatsApp (WhatsApp Cloud API de Meta)
   Variables de entorno (en Vercel, nunca en el código):
     WHATSAPP_TOKEN         token de acceso permanente (usuario del sistema)
     WHATSAPP_PHONE_ID      "Phone number ID" del número del negocio
     WHATSAPP_VERIFY_TOKEN  palabra secreta que inventas tú para el webhook
     WHATSAPP_APP_SECRET    "App secret" de la app de Meta (firma los avisos)
   Solo usa fetch y crypto, que ya vienen con Node: sin librerías.
   ============================================================= */
import crypto from 'node:crypto';
import { query } from './db.js';

// Versión de la API de Meta. Cada versión dura unos 2 años: cuando Meta
// avise de que caduca, cambia el número aquí (el formato no suele cambiar).
const API = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';

export const whatsappConfigurado = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID &&
          process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET);

/** Meta firma cada aviso con el App secret: así sabemos que viene de Meta y no de cualquiera */
export function firmaValida(crudo, cabecera) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || typeof cabecera !== 'string' || !cabecera.startsWith('sha256=')) return false;
  const esperada = Buffer.from('sha256=' + crypto.createHmac('sha256', secreto).update(crudo).digest('hex'));
  const recibida = Buffer.from(cabecera);
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
}

/* WhatsApp limita el largo de cada parte de un mensaje interactivo.
   Si nos pasamos, rechaza el mensaje entero: por eso se recorta todo. */
const corta = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

/** Convierte nuestro formato sencillo al formato de la API:
      { texto }                                   → mensaje normal
      { texto, botones: [{ id, titulo }] }         → hasta 3 botones
      { texto, lista: { boton, filas: [{ id, titulo, descripcion }] } } → menú de hasta 10 opciones */
function aFormatoMeta(para, m) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: para };
  if (m.botones) {
    return { ...base, type: 'interactive', interactive: {
      type: 'button',
      body: { text: corta(m.texto, 1024) },
      action: { buttons: m.botones.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: corta(b.titulo, 20) } })) }
    } };
  }
  if (m.lista) {
    return { ...base, type: 'interactive', interactive: {
      type: 'list',
      body: { text: corta(m.texto, 1024) },
      action: {
        button: corta(m.lista.boton, 20),
        sections: [{ title: corta(m.lista.seccion || 'Opciones', 24), rows: m.lista.filas.slice(0, 10).map(f => ({
          id: f.id, title: corta(f.titulo, 24), ...(f.descripcion ? { description: corta(f.descripcion, 72) } : {})
        })) }]
      }
    } };
  }
  return { ...base, type: 'text', text: { body: corta(m.texto, 4096), preview_url: false } };
}

/** Texto que se guarda en el historial (lo que verá Nadia en el panel) */
function textoHistorial(m) {
  if (m.botones) return `${m.texto}\n[${m.botones.map(b => b.titulo).join('] [')}]`;
  if (m.lista) return `${m.texto}\n[${m.lista.boton}: ${m.lista.filas.map(f => f.titulo).join(', ')}]`;
  return m.texto;
}

/** Envía un mensaje y lo guarda en el historial. autor: 'bot' o 'nadia' */
export async function enviarWhatsApp(para, mensaje, autor = 'bot') {
  let r;
  try {
    r = await fetch(`${API}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(aFormatoMeta(para, mensaje)),
      signal: AbortSignal.timeout(8000) // si Meta no responde, no esperar eternamente
    });
  } catch (e) {
    throw Object.assign(new Error('No se ha podido conectar con WhatsApp.'), { code: 'WA_API' });
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(datos.error?.message || `WhatsApp respondió ${r.status}`);
    e.code = 'WA_API';
    e.waCode = datos.error?.code; // 131047 = han pasado más de 24 h desde el último mensaje del cliente
    throw e;
  }
  await query('INSERT INTO wa_mensajes (telefono, autor, texto, wa_id) VALUES ($1, $2, $3, $4)',
    [para, autor, textoHistorial(mensaje), datos.messages?.[0]?.id || null]);
  return datos;
}
```

`api/_lib/bot.js` — the brain: texts in Spanish and Galician (`T`), keywords (`CLAVES`), menu, booking steps, "my bookings":

| Function | What it does |
|---|---|
| `temaDe(text)` | Normalises the text (lower case, no accents, ñ→n) and returns the first topic whose keyword appears. **Order matters**: specific topics first |
| `pareceGallego(text)` | Guesses Galician from the first message, to answer in the client's language |
| `menu(L)` | The "Ver opciones" list with the 7 topics |
| `despues(L, text)` | An answer with the 3 standard buttons (Reservar / Menú / Hablar con Nadia) |
| `diasLibres()` | Free slots for the next 14 days, with the same rules as the website (`huecoReservable` + bookings + blocks) |
| `preguntarDia`, `preguntarHora` | Send the day list / hour list (or say there's nothing free) |
| `resumen(L, data)` | Summary with Confirmar / Cambiar hora / Cancelar and the privacy link |
| `misCitas(L, phone)` | Lists the client's future bookings with a Cancel button for each |
| `tema(name, chat, L)` | Answers one topic of the menu |
| `saludo(lang, name)` | Greeting for the first message of a new client |
| `responder(chat, input)` | **Entry point**: decides the answer from the input and the current `paso`, returns `{mensajes, paso, datos, idioma, humano}` |

File: `web-profesional/api/_lib/bot.js`

```js
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
```

`api/whatsapp.js` — the webhook that Meta calls:

File: `web-profesional/api/whatsapp.js`

```js
/* =============================================================
   /api/whatsapp  (webhook de WhatsApp — lo llama Meta, no la web)
   GET  → Meta comprueba que el webhook es tuyo (una sola vez, al configurarlo)
   POST → Meta avisa de cada mensaje que recibe el número del negocio.
          Se comprueba la firma, se guarda el mensaje y el bot contesta.
   ============================================================= */
import crypto from 'node:crypto';
import { query } from './_lib/db.js';
import { cuerpoCrudo, parametros } from './_lib/http.js';
import { whatsappConfigurado, firmaValida, enviarWhatsApp } from './_lib/whatsapp.js';
import { responder, temaDe, pareceGallego, saludo } from './_lib/bot.js';

// Para comprobar la firma hace falta el cuerpo EXACTO que envió Meta,
// así que le pedimos a Vercel que no lo convierta a JSON.
export const config = { api: { bodyParser: false } };

const HORAS_HUMANO = 24;  // tras "Hablar con Nadia", el bot calla durante este tiempo
const MINUTOS_PASO = 120; // una reserva a medias se olvida tras 2 horas sin respuesta

export default async function handler(req, res) {
  if (req.method === 'GET') return verificar(req, res);
  if (req.method !== 'POST') return responderTexto(res, 405, '');
  if (!whatsappConfigurado()) return responderTexto(res, 503, 'WhatsApp no configurado');

  const crudo = await cuerpoCrudo(req);
  if (!firmaValida(crudo, req.headers['x-hub-signature-256'])) return responderTexto(res, 401, 'Firma no válida');

  let aviso;
  try { aviso = JSON.parse(crudo.toString('utf8')); } catch { return responderTexto(res, 400, ''); }

  for (const entry of aviso.entry || []) {
    for (const cambio of entry.changes || []) {
      const v = cambio.value || {};
      if (v.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_ID) continue;
      const nombres = Object.fromEntries((v.contacts || []).map(c => [c.wa_id, c.profile?.name]));
      // v.statuses (enviado, entregado, leído) llegan también aquí: no los necesitamos
      for (const m of v.messages || []) {
        try { await atender(m, nombres[m.from]); } catch (e) { console.error('WhatsApp:', e); }
      }
    }
  }
  // Siempre 200: si respondemos con error, Meta repite el aviso durante días
  responderTexto(res, 200, 'ok');
}

function responderTexto(res, estado, texto) {
  res.statusCode = estado;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(texto);
}

/** Meta manda hub.verify_token (tu palabra secreta) y espera que le devolvamos hub.challenge */
function verificar(req, res) {
  const p = parametros(req);
  const esperado = Buffer.from(process.env.WHATSAPP_VERIFY_TOKEN || '');
  const recibido = Buffer.from(p.get('hub.verify_token') || '');
  const ok = p.get('hub.mode') === 'subscribe' && esperado.length > 0 &&
    esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido);
  return ok ? responderTexto(res, 200, p.get('hub.challenge') || '') : responderTexto(res, 403, 'Token incorrecto');
}

/** Traduce el mensaje de Meta a algo sencillo para el bot */
function leerEntrada(m) {
  if (m.type === 'text') return { tipo: 'texto', texto: m.text?.body || '' };
  if (m.type === 'interactive') {
    const r = m.interactive?.button_reply || m.interactive?.list_reply || {};
    return { tipo: 'opcion', id: r.id || '', texto: r.title || '' };
  }
  if (m.type === 'button') return { tipo: 'texto', texto: m.button?.text || '' };
  return { tipo: 'otro' };
}

async function atender(m, nombrePerfil) {
  const telefono = m.from;
  const entrada = leerEntrada(m);

  // 1. Guardar el mensaje. Si ya existía, Meta lo está repitiendo: no se contesta dos veces.
  const nuevo = await query(
    `INSERT INTO wa_mensajes (telefono, autor, texto, wa_id) VALUES ($1, 'cliente', $2, $3)
     ON CONFLICT (wa_id) DO NOTHING RETURNING id`,
    [telefono, entrada.texto || `[${m.type}]`, m.id]
  );
  if (!nuevo.rowCount) return;

  // 2. Crear o actualizar la conversación. (xmax = 0) es true solo si la fila es nueva.
  const { rows: [chat] } = await query(
    `INSERT INTO wa_chats (telefono, nombre, idioma, sin_leer, ultimo_entrante)
     VALUES ($1, $2, $3, 1, now())
     ON CONFLICT (telefono) DO UPDATE SET
       nombre = COALESCE(EXCLUDED.nombre, wa_chats.nombre),
       sin_leer = wa_chats.sin_leer + 1,
       ultimo_entrante = now()
     RETURNING *, (xmax = 0) AS es_nuevo`,
    [telefono, nombrePerfil || null, pareceGallego(entrada.texto) ? 'gl' : 'es']
  );

  // 3. Si Nadia está atendiendo, el bot calla (salvo que el cliente pida el menú)
  const enPausa = chat.modo === 'humano' && chat.humano_hasta && new Date(chat.humano_hasta) > new Date();
  const pideMenu = entrada.id === 'tema:menu' || (entrada.tipo === 'texto' && temaDe(entrada.texto) === 'menu');
  if (enPausa && !pideMenu) return;

  // 4. Una reserva a medias de hace horas se olvida
  if (chat.paso && Date.now() - new Date(chat.actualizado).getTime() > MINUTOS_PASO * 60e3) {
    chat.paso = null;
    chat.datos = {};
  }

  // 5. El bot decide qué contestar
  const r = await responder(chat, entrada);
  const esSaludo = entrada.tipo === 'texto' && temaDe(entrada.texto) === 'hola';
  if (chat.es_nuevo && !esSaludo) r.mensajes.unshift(saludo(r.idioma, chat.nombre));

  // 6. Enviar las respuestas en orden y guardar en qué punto se ha quedado
  for (const mensaje of r.mensajes) await enviarWhatsApp(telefono, mensaje);
  await query(
    `UPDATE wa_chats SET paso = $2, datos = $3, idioma = $4,
       modo = $5, humano_hasta = CASE WHEN $5 = 'humano' THEN now() + make_interval(hours => $6) END,
       actualizado = now()
     WHERE telefono = $1`,
    [telefono, r.paso, JSON.stringify(r.datos || {}), r.idioma, r.humano ? 'humano' : 'bot', HORAS_HUMANO]
  );
}
```

`api/admin/whatsapp.js` — the private API behind the panel's WhatsApp tab:

File: `web-profesional/api/admin/whatsapp.js`

```js
/* =============================================================
   /api/admin/whatsapp  (solo con sesión)
   GET                       → lista de conversaciones
   GET   ?telefono=34600…    → mensajes de una conversación (y la marca como leída)
   POST  { telefono, texto } → Nadia contesta (el bot se pausa 24 h en ese chat)
   PATCH { telefono, modo }  → 'bot' (el bot vuelve a contestar) o 'humano' (pausarlo)
   ============================================================= */
import { query } from '../_lib/db.js';
import { enviar, permitir, cuerpo, esJson, parametros, fallo, texto } from '../_lib/http.js';
import { sesionActiva } from '../_lib/auth.js';
import { whatsappConfigurado, enviarWhatsApp } from '../_lib/whatsapp.js';

const DIAS_HISTORIAL = 180; // los mensajes más antiguos se borran (privacidad: no guardar de más)
const RE_TELEFONO = /^\d{8,15}$/;
const EN_PAUSA = `(modo = 'humano' AND humano_hasta > now())`;
const VENTANA_ABIERTA = `(ultimo_entrante > now() - interval '24 hours')`;

export default async function handler(req, res) {
  if (!permitir(req, res, ['GET', 'POST', 'PATCH'])) return;
  if (!sesionActiva(req)) return enviar(res, 401, { error: 'Tu sesión ha caducado. Vuelve a entrar.' });
  if (req.method !== 'GET' && !esJson(req)) return enviar(res, 415, { error: 'Formato no válido.' });

  try {
    if (req.method === 'GET') {
      const telefono = parametros(req).get('telefono');
      return telefono ? await conversacion(res, telefono) : await lista(res);
    }
    if (req.method === 'POST') return await contestar(req, res);
    return await cambiarModo(req, res);
  } catch (e) {
    fallo(res, e);
  }
}

async function lista(res) {
  await query(`DELETE FROM wa_mensajes WHERE creado < now() - make_interval(days => $1)`, [DIAS_HISTORIAL]);
  const { rows } = await query(
    `SELECT c.telefono, c.nombre, c.sin_leer, ${EN_PAUSA} AS en_pausa, u.texto AS ultimo, u.autor AS ultimo_autor, u.creado AS ultimo_en
       FROM wa_chats c
       LEFT JOIN LATERAL (SELECT texto, autor, creado FROM wa_mensajes m
                           WHERE m.telefono = c.telefono ORDER BY creado DESC, id DESC LIMIT 1) u ON true
      ORDER BY u.creado DESC NULLS LAST
      LIMIT 100`);
  enviar(res, 200, {
    configurado: whatsappConfigurado(),
    chats: rows,
    esperando: rows.filter(c => c.en_pausa && c.sin_leer > 0).length
  });
}

async function conversacion(res, telefono) {
  if (!RE_TELEFONO.test(telefono)) return enviar(res, 400, { error: 'Teléfono no válido.' });
  const { rows: [chat] } = await query(
    `UPDATE wa_chats SET sin_leer = 0 WHERE telefono = $1
     RETURNING telefono, nombre, ${EN_PAUSA} AS en_pausa, humano_hasta, ${VENTANA_ABIERTA} AS ventana_abierta`, [telefono]);
  if (!chat) return enviar(res, 404, { error: 'No existe esa conversación.' });
  const { rows } = await query(
    `SELECT * FROM (SELECT id, autor, texto, creado FROM wa_mensajes WHERE telefono = $1 ORDER BY creado DESC, id DESC LIMIT 200) t
      ORDER BY creado, id`, [telefono]);
  enviar(res, 200, { chat, mensajes: rows });
}

async function contestar(req, res) {
  const b = cuerpo(req) || {};
  const telefono = texto(b.telefono, 20);
  const mensaje = texto(b.texto, 4000);
  if (!RE_TELEFONO.test(telefono) || !mensaje) return enviar(res, 400, { error: 'Escribe un mensaje.' });
  if (!whatsappConfigurado()) return enviar(res, 503, { error: 'WhatsApp aún no está configurado en Vercel.' });

  const { rows: [chat] } = await query(`SELECT ${VENTANA_ABIERTA} AS ventana_abierta FROM wa_chats WHERE telefono = $1`, [telefono]);
  if (!chat) return enviar(res, 404, { error: 'No existe esa conversación.' });
  // Regla de WhatsApp: pasadas 24 h desde el último mensaje del cliente, la empresa
  // solo puede escribirle con una plantilla aprobada por Meta.
  if (!chat.ventana_abierta) {
    return enviar(res, 409, { error: 'Han pasado más de 24 h desde su último mensaje: WhatsApp no deja escribirle desde aquí. Llámale o espera a que vuelva a escribir.' });
  }

  try {
    await enviarWhatsApp(telefono, { texto: mensaje }, 'nadia');
  } catch (e) {
    if (e.code !== 'WA_API') throw e;
    return enviar(res, 502, { error: `WhatsApp no ha aceptado el mensaje: ${e.message}` });
  }
  // Mientras Nadia habla, el bot no interrumpe
  await query(`UPDATE wa_chats SET modo = 'humano', humano_hasta = now() + interval '24 hours', paso = NULL, datos = '{}' WHERE telefono = $1`, [telefono]);
  enviar(res, 201, { ok: true });
}

async function cambiarModo(req, res) {
  const { telefono, modo } = cuerpo(req) || {};
  if (!RE_TELEFONO.test(String(telefono)) || !['bot', 'humano'].includes(modo)) return enviar(res, 400, { error: 'Datos no válidos.' });
  const { rowCount } = await query(
    modo === 'bot'
      ? `UPDATE wa_chats SET modo = 'bot', humano_hasta = NULL, paso = NULL, datos = '{}' WHERE telefono = $1`
      : `UPDATE wa_chats SET modo = 'humano', humano_hasta = now() + interval '24 hours' WHERE telefono = $1`,
    [telefono]);
  if (!rowCount) return enviar(res, 404, { error: 'No existe esa conversación.' });
  enviar(res, 200, { ok: true });
}
```

**Panel (`admin/index.html`)**, new functions:

| Function | What it does |
|---|---|
| `verPestana('agenda' \| 'wa')` | Switches between the Agenda and WhatsApp tabs |
| `cargarChats()` | Loads the chat list, the green number on the tab (clients waiting) and the notice |
| `abrirChat(phone)` | Opens a conversation (marks it as read), shows "bot en pausa hasta…" and hides the reply box if the 24 h window is closed |
| `conNegritas(text)` | Shows WhatsApp's `*bold*` as bold, without `innerHTML` (safe against injected HTML) |
| `accionWa()` | Sends a reply or toggles the bot, then reloads the chat |
| `refrescarWa()` | Every 15 s: reloads the open chat or the list |

New API rows (add to 5.12):

| Method | URL | Access | Body / params | Answers |
|---|---|---|---|---|
| GET | `/api/whatsapp` | Meta | `?hub.mode&hub.verify_token&hub.challenge` | 200 challenge · 403 |
| POST | `/api/whatsapp` | Meta (signed) | Meta's webhook JSON | 200 · 401 bad signature · 503 not configured |
| GET | `/api/admin/whatsapp` | Session | `?telefono=` (optional) | 200 `{chats[], esperando, configurado}` or `{chat, mensajes[]}` |
| POST | `/api/admin/whatsapp` | Session | `{telefono, texto}` | 201 · 409 window closed · 502 Meta refused · 503 |
| PATCH | `/api/admin/whatsapp` | Session | `{telefono, modo: 'bot'\|'humano'}` | 200 · 404 |

### 13.6 Testing it on your computer (without Meta)

`tools/whatsapp-test.mjs` pretends to be Meta in both directions: it sends **signed** fake messages to your local webhook and runs a fake Graph API on port 3078 that records what the bot sends. Nothing reaches real WhatsApp.

```bash
# terminal 1: the dev server with fake WhatsApp variables
DATABASE_URL=postgres://postgres:YOURPASSWORD@localhost:5432/lagoa_test \
ADMIN_PASSWORD=una-clave-de-prueba \
WHATSAPP_TOKEN=token-de-prueba WHATSAPP_PHONE_ID=PHONE1 \
WHATSAPP_VERIFY_TOKEN=verifica-esto WHATSAPP_APP_SECRET=secreto-app \
WHATSAPP_API_URL=http://127.0.0.1:3078/v23.0 \
node tools/dev-server.mjs web-profesional

# terminal 2
psql "postgres://postgres:YOURPASSWORD@localhost:5432/lagoa_test" -c "TRUNCATE citas, bloqueos, wa_chats, wa_mensajes RESTART IDENTITY;"
ADMIN_PASSWORD=una-clave-de-prueba node tools/whatsapp-test.mjs
```

**All 49 lines must say OK.** They cover webhook verification, fake and missing signatures, Meta repeating a message, the menu, prices, unknown text, audio, other business numbers, the whole booking flow, a slot taken while the client is confirming, the website and the bot competing for the same hour, "my bookings", cancelling (and another number trying to cancel it), the 2-booking limit, handover to the owner, replying from the panel, the 24 h window, Galician, a forgotten half-done booking, and the panel API without a session.

`WHATSAPP_API_URL` exists only for these tests; in Vercel, **don't set it** (the code uses the real `https://graph.facebook.com/v23.0`).

File: `tools/whatsapp-test.mjs`

```js
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
```

### 13.7 Adapting the bot for a client

1. **Texts:** `T.es` and `T.gl` in `bot.js` (delete `gl` and `pareceGallego` if the client doesn't need Galician).
2. **Menu:** `T.es.menu` (max 10 rows). Each key is a topic that `tema()` must answer.
3. **Keywords:** `CLAVES`. Test them like this: `node -e "import('./web-profesional/api/_lib/bot.js').then(b => console.log(b.temaDe('cuánto cuesta')))"`. Avoid words that appear inside common phrases ("vale" = "OK" in Spanish, "nadia" in "Hola Nadia").
4. **Business data:** `negocio.js` (services, prices, timings, website URL).
5. **Booking options:** `MODALIDADES` in `citas.js` and `T.es.modos` (button labels, same order, max 3). A hairdresser might use "Corte / Color / Peinado" instead.
6. **Never let the bot invent:** discounts, payment terms or anything not agreed with the client → send to the human (`pago` topic does this).
7. Run `tools/whatsapp-test.mjs` and adjust the assertions that check texts you changed.

### 13.8 Problems and solutions

| Symptom | Probable cause | Fix |
|---|---|---|
| Meta says "The callback URL or verify token couldn't be validated" | Token different from `WHATSAPP_VERIFY_TOKEN`, no redeploy after adding it, or wrong URL | Same text in both places; Redeploy; open `https://YOUR-DOMAIN/api/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR-TOKEN&hub.challenge=1` → must show `1` |
| Verified, but the bot never answers | Not subscribed to the **`messages`** field | Configuration → Webhook fields → `messages` → Subscribe |
| Vercel Logs show 401 on `/api/whatsapp` | `WHATSAPP_APP_SECRET` wrong (or from another app) | Copy it again from App settings → Basic; Redeploy |
| Logs: `WhatsApp: … access token … expired` (code 190) | Using the 24 h temporary token | Create the permanent system-user token (13.3 step 5) |
| Logs: recipient not in allowed list (code 131030) | Test number writing to a phone you didn't add | API Setup → *To* → add and verify the phone |
| Panel: "Han pasado más de 24 h…" | Meta's 24 h rule | Call the client or wait until they write; for reminders you need templates |
| Bot answers in the wrong language | First message guessed wrong | The client writes "castellano" or "galego" |
| Prices differ between web and bot | Changed only one place | `SERVICES`/`PACK` in `index.html` **and** `negocio.js` |
| Meta says the API version is deprecated | Each version lasts ~2 years | Change `v23.0` in `api/_lib/whatsapp.js` to the current version |
| Everything looks configured (webhook verified, `messages` subscribed) but a real message from your phone produces **no log at all** — not even an error | The test WhatsApp Business Account is actually delivering its events to Meta's own internal app (`WA DevX Webhook Events 1P App`), not to yours. The green "Subscribed" toggle in *Webhook fields* only means the **app** is configured to receive events — it doesn't guarantee the **WABA** is sending them to this particular app | See 13.9 below to check and fix it with the Graph API Explorer |

### 13.9 Deep debugging: the test number sends its events to someone else's app

If you've verified the webhook, subscribed to `messages`, and clicking the dashboard's "Test" button (next to the `messages` row in *Webhook fields*) does produce a log line in Vercel — but a **real** message from your own phone produces nothing at all — the test WABA itself may not be pointed at your app. This is separate from the webhook URL/token configuration, and Meta's UI gives no obvious warning about it.

1. Go to https://developers.facebook.com/tools/explorer
2. Pick your app (top right) and paste a valid access token (the temporary one from API Setup works).
3. Clear the request path and type: `YOUR_WABA_ID/subscribed_apps` (the Business Account ID, not the Phone Number ID) → method **GET** → *Submit*.
4. Read the `data` array:
   - Your app's name is there → the WABA is fine, look elsewhere (token expired, phone_number_id mismatch, etc. — see the table above).
   - Only `WA DevX Webhook Events 1P App` (or another app) is there, yours is missing → that's the bug.
5. Fix it: same path, switch the method to **POST**, *Submit*. This subscribes your app to the WABA (it's added, the other one isn't necessarily removed — that's fine, both can coexist).
6. Re-run the GET to confirm your app now appears, then send a real WhatsApp message again and check the Vercel logs.

---

*Built for Lagoa · Estudio digital (A Coruña). Code: `web-profesional/` in this repository. Tests: `tools/api-test.mjs` and `tools/whatsapp-test.mjs`.*
