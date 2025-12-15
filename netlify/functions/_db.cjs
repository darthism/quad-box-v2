const { Pool } = require('pg')

let pool

function getConnectionString() {
  return (
    process.env.TIMESCALE_SERVICE_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONNECTION_STRING ||
    ''
  )
}

function getPool() {
  if (pool) return pool

  const connectionString = getConnectionString()
  if (!connectionString) {
    throw new Error('Missing TIMESCALE_SERVICE_URL (or DATABASE_URL) env var.')
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
  })
  return pool
}

async function query(text, params) {
  const p = getPool()
  return await p.query(text, params)
}

module.exports = { query }


