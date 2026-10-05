# Website with online bookings and a private agenda — complete tutorial

> **What this is:** the step-by-step guide to rebuild the Lagoa website (public site + booking system + private admin panel) for any client, without help.
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

---

## 0. What you are building

Three pieces that work together:

| Piece | What it is | Files |
|---|---|---|
| **Public website** | One HTML page: services, prices, budget calculator, chatbot, booking form, contact form, FAQ | `index.html`, `img/`, `robots.txt`, `sitemap.xml` |
| **Backend (API)** | Small server functions that Vercel runs on demand. They check and save bookings in a Postgres database | `api/` + `package.json` |
| **Admin panel** | A private page with a password where the owner sees the week, confirms, cancels, blocks slots and adds bookings by hand | `admin/index.html` |

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

**Costs:** Vercel Hobby (free), Neon free plan (0.5 GB, more than enough for thousands of bookings), FormSubmit (free). A custom domain costs about 10–15 €/year.

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
    ├── admin/
    │   ├── login.js            ← POST /api/admin/login
    │   ├── logout.js           ← POST /api/admin/logout
    │   ├── sesion.js           ← GET  /api/admin/sesion
    │   ├── citas.js            ← GET/POST/PATCH /api/admin/citas
    │   └── bloqueos.js         ← POST/DELETE /api/admin/bloqueos
    └── _lib/                   ← starts with "_" → NOT a URL, shared code only
        ├── db.js               ← database connection + tables
        ├── horario.js          ← bookable hours, time zone, date helpers
        ├── http.js             ← small helpers for requests/responses
        └── auth.js             ← password check + signed session cookie

tools/ (at the repository root, never published)
├── dev-server.mjs              ← local server that imitates Vercel
└── api-test.mjs                ← 38 automatic tests of the API
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
- Unknown questions → `fallback` answer + WhatsApp button with the whole conversation already written.
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
- HTTP status codes used: **200** OK · **201** created · **400** invalid data · **401** not logged in · **404** not found · **405** wrong method · **409** conflict (slot taken) · **415** not JSON · **429** too many · **500** server error · **503** database not configured.

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
4. Slot not blocked by the owner.
5. **Anti-abuse:** at most 2 future active bookings per phone. It compares the **last 9 digits**, so `+34 600 111 222`, `600-111-222` and `600111222` are the same person.
6. `INSERT`. If Postgres raises error **23505** (unique violation), someone took the hour first → **409** with a friendly message.

**To add a field for a client** (for example "servicio"):

1. Add the column to the `CREATE TABLE` in `db.js`. For an existing database, run once in the Neon SQL editor: `ALTER TABLE citas ADD COLUMN servicio TEXT;`
2. Read and validate it here (`texto(b.servicio, 80)`) and add it to the `INSERT`.
3. Send it from `guardarEnAgenda()` in `index.html`.
4. Return it in `CAMPOS` in `api/admin/citas.js` and show it in `tarjetaCita()` in the panel.

File: `web-profesional/api/reservas.js`

```js
/* =============================================================
   POST /api/reservas  (pública)
   Guarda la solicitud de consulta de un cliente. Antes valida todo
   en el servidor: lo que llega del navegador nunca es de fiar.
   ============================================================= */
import { query } from './_lib/db.js';
import { enviar, permitir, cuerpo, esJson, fallo, texto } from './_lib/http.js';
import { huecoReservable, hoyMadrid } from './_lib/horario.js';

export const MODALIDADES = ['Videollamada', 'Llamada de teléfono', 'En persona (solo A Coruña ciudad)'];
const MAX_CITAS_POR_TELEFONO = 2; // citas futuras activas a la vez (frena reservas en masa)

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
    const bloqueado = await query('SELECT 1 FROM bloqueos WHERE fecha = $1 AND hora = $2', [d.fecha, d.hora]);
    if (bloqueado.rowCount) return enviar(res, 409, { error: 'Esa hora ya no está disponible. Elige otra, por favor.' });

    // Mismo número aunque se escriba distinto (+34 600…, 600-…): se comparan los 9 últimos dígitos
    const numero = d.telefono.replace(/\D/g, '').slice(-9);
    const { rows: [{ n }] } = await query(
      `SELECT count(*)::int AS n FROM citas
        WHERE right(regexp_replace(telefono, '[^0-9]', '', 'g'), 9) = $1
          AND estado <> 'cancelada' AND fecha >= $2`,
      [numero, hoyMadrid()]
    );
    if (n >= MAX_CITAS_POR_TELEFONO) {
      return enviar(res, 429, { error: 'Ya tienes citas pendientes con este teléfono. Si necesitas otra, escríbeme por WhatsApp.' });
    }

    const { rows: [cita] } = await query(
      `INSERT INTO citas (fecha, hora, modalidad, nombre, negocio, telefono, email, nota)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, ''), NULLIF($8, ''))
       RETURNING id`,
      [d.fecha, d.hora, d.modalidad, d.nombre, d.negocio, d.telefono, d.email, d.nota]
    );
    enviar(res, 201, { ok: true, id: cita.id });
  } catch (e) {
    // 23505 = la regla "una cita por hora" de la base de datos ha saltado
    if (e.code === '23505') return enviar(res, 409, { error: 'Esa hora se acaba de ocupar. Elige otra, por favor.' });
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

To adapt for a client: the WhatsApp confirmation text inside `tarjetaCita()` (it signs "Nadia · Lagoa"), the colours in `:root`, the title, and the modalities list in the "Nueva cita" dialog (they must match `MODALIDADES` in `api/reservas.js`).

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
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if ((req.headers['content-type'] || '').includes('application/json') && raw) {
      try { req.body = JSON.parse(raw); } catch { req.body = raw; }
    } else {
      req.body = raw || undefined;
    }
    try {
      const mod = await import(pathToFileURL(file).href);
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

Run them **every time you change the backend**, before deploying.

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
| Prices | `SERVICES`/`PACK` in `index.html` **and** the fixed texts of the service cards + JSON-LD |
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
- [ ] Privacy policy names every provider (Vercel, Neon, FormSubmit, Meta) and the owner's details.
- [ ] Neon database in an EU region.

---

## 12. Ideas to extend it

Ordered from easiest to hardest:

1. **Show the "servicio" in each booking** (hairdresser: cut, colour…): section 5.8 "To add a field".
2. **Booking duration:** a 60-minute service blocks two 30-minute slots. Store `duracion` and check overlaps in SQL.
3. **Server-side email** with Resend (https://resend.com, free tier): send the confirmation from `api/reservas.js` instead of FormSubmit, with an `RESEND_API_KEY` variable.
4. **Automatic reminders:** a **Vercel Cron Job** (`vercel.json` → `"crons"`) that runs every evening, finds tomorrow's confirmed bookings and sends an email or WhatsApp reminder (WhatsApp needs the WhatsApp Business API).
5. **Google Calendar sync** with the `googleapis` library and a service account: each confirmed booking also appears in the owner's calendar.
6. **Several employees:** add a `profesional` column and include it in the unique index `(fecha, hora, profesional)`.
7. **Client self-cancellation:** a secret link per booking (random token stored in the table) that lets the client cancel without logging in.
8. **Turn it into a product:** one codebase for all your clients, where each client's texts and hours come from a configuration file. That's the step from "a website" to "your own booking software".

---

*Built for Lagoa · Estudio digital (A Coruña). Code: `web-profesional/` in this repository. Tests: `tools/api-test.mjs`.*
