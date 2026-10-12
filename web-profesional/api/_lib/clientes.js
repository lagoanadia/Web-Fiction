/* =============================================================
   Fichas de clientes (CRM)
   Se busca a la persona por email o por teléfono (9 últimas cifras).
   Si ya existe, solo se rellenan los datos que faltaban: un pedido
   desde la web nunca sobrescribe lo que ya hay (así nadie puede
   cambiar la ficha de otro escribiendo su email).
   ============================================================= */
import { query } from './db.js';
import { ultimos9 } from './citas.js';

const limpio = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Devuelve el id del cliente. (Fuera de transacciones: un error de duplicado se recupera aquí.) */
export async function buscarOCrearCliente(d, origen = 'web') {
  const q = query;
  const email = limpio(d.email)?.toLowerCase() || null;
  const tel9 = d.telefono ? ultimos9(d.telefono) : '';
  const { rows } = await q(
    `SELECT id FROM clientes
      WHERE ($1::text IS NOT NULL AND lower(email) = $1) OR (length($2::text) = 9 AND tel9 = $2::text)
      ORDER BY (lower(email) = $1::text) DESC NULLS LAST, id LIMIT 1`, [email, tel9]);
  if (rows.length) {
    await q(
      `UPDATE clientes SET
         email = coalesce(email, $2), telefono = coalesce(nullif(telefono, ''), $3),
         negocio = coalesce(nullif(negocio, ''), $4), nif = coalesce(nullif(nif, ''), $5),
         direccion = coalesce(nullif(direccion, ''), $6)
       WHERE id = $1`,
      [rows[0].id, email, limpio(d.telefono), limpio(d.negocio), limpio(d.nif), limpio(d.direccion)]
    ).catch(e => { if (e.code !== '23505') throw e; }); // otro cliente ya tiene ese email: no se toca
    return rows[0].id;
  }
  try {
    const { rows: [c] } = await q(
      `INSERT INTO clientes (nombre, email, telefono, negocio, nif, direccion, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [limpio(d.nombre) || 'Sin nombre', email, limpio(d.telefono), limpio(d.negocio), limpio(d.nif), limpio(d.direccion), origen]
    );
    return c.id;
  } catch (e) {
    if (e.code !== '23505') throw e;
    const { rows: [c] } = await q('SELECT id FROM clientes WHERE lower(email) = $1', [email]); // creado a la vez por otra petición
    return c.id;
  }
}
