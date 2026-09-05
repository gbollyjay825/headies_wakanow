const { Pool } = require('pg');
const { readStore, writeStore } = require('./store');

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' || /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30000
}) : null;

function fromRow(row) {
  return row ? {
    ...row.details,
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotency_key,
    tokenHash: row.token_hash,
    totalAmountKobo: Number(row.total_amount_kobo),
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  } : null;
}

async function findBy(field, value) {
  if (pool) {
    const columns = { id: 'id', reference: 'reference', idempotencyKey: 'idempotency_key' };
    const result = await pool.query(`select * from package_bookings where ${columns[field]} = $1`, [value]);
    return fromRow(result.rows[0]);
  }
  return readStore().packageBookings.find((booking) => booking[field] === value) || null;
}

async function create(booking) {
  if (pool) {
    const result = await pool.query(`insert into package_bookings
      (id, reference, idempotency_key, token_hash, total_amount_kobo, payment_status, fulfillment_status, details, created_at, updated_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) on conflict (idempotency_key) do nothing returning *`,
    [booking.id, booking.reference, booking.idempotencyKey, booking.tokenHash, booking.totalAmountKobo,
      booking.paymentStatus, booking.fulfillmentStatus, JSON.stringify(booking), booking.createdAt, booking.updatedAt]);
    return result.rows[0] ? { booking: fromRow(result.rows[0]), created: true }
      : { booking: await findBy('idempotencyKey', booking.idempotencyKey), created: false };
  }
  const store = readStore();
  const existing = store.packageBookings.find((item) => item.idempotencyKey === booking.idempotencyKey);
  if (existing) return { booking: existing, created: false };
  store.packageBookings.unshift(booking);
  writeStore(store);
  return { booking, created: true };
}

// Each mutation reads the latest row under a lock so concurrent verification,
// webhook delivery and checkout responses cannot downgrade a received payment.
async function update(id, mutate) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query('select * from package_bookings where id = $1 for update', [id]);
      const previous = fromRow(result.rows[0]);
      if (!previous) {
        await client.query('commit');
        return null;
      }
      const next = { ...mutate(previous), updatedAt: new Date().toISOString() };
      const saved = await client.query(`update package_bookings set payment_status = $2,
        fulfillment_status = $3, details = $4::jsonb, updated_at = $5 where id = $1 returning *`,
      [id, next.paymentStatus, next.fulfillmentStatus, JSON.stringify(next), next.updatedAt]);
      await client.query('commit');
      return fromRow(saved.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  const store = readStore();
  const index = store.packageBookings.findIndex((booking) => booking.id === id);
  if (index < 0) return null;
  const next = { ...mutate(store.packageBookings[index]), updatedAt: new Date().toISOString() };
  store.packageBookings[index] = next;
  writeStore(store);
  return next;
}

async function list() {
  if (pool) return (await pool.query('select * from package_bookings order by created_at desc')).rows.map(fromRow);
  return readStore().packageBookings.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

module.exports = { findBy, create, update, list, close: () => pool ? pool.end() : Promise.resolve() };
