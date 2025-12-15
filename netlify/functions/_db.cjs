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

function normalizeConnectionString(connectionString) {
  // pg's connection-string parsing may turn ?sslmode=require into ssl=true and override our ssl object.
  // To ensure our ssl options (with CA) are respected, strip sslmode from the URL.
  try {
    const u = new URL(connectionString)
    if (u.searchParams.has('sslmode')) {
      u.searchParams.delete('sslmode')
    }
    u.search = u.searchParams.toString()
    return u.toString()
  } catch {
    return connectionString
  }
}

const TIMESCALE_CA_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBpzCCAUygAwIBAgIQfH0seuAygeQX2lTU/eVncDAKBggqhkjOPQQDAjAzMRYw',
  'FAYDVQQKEw1UaW1lc2NhbGUgSW5jMRkwFwYDVQQDExBjYS50aW1lc2NhbGUuY29t',
  'MB4XDTI1MDEyMzE1NDMzOVoXDTI3MTAyMDE1NDMzOVowMzEWMBQGA1UEChMNVGlt',
  'ZXNjYWxlIEluYzEZMBcGA1UEAxMQY2EudGltZXNjYWxlLmNvbTBZMBMGByqGSM49',
  'AgEGCCqGSM49AwEHA0IABKRa3FQeN67oUZK6PdG7FtZKYSv1WgJrZ64mfX9pLNlE',
  'EeVzCnHIAcE9xsQ5j/gccgu9oyiJ/CcLPlkzBHe34M2jQjBAMA4GA1UdDwEB/wQE',
  'AwICpDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBTZ/kgiRgLuL0Tg7eYuwBps',
  '25fwzDAKBggqhkjOPQQDAgNJADBGAiEAvH4JAMgGPL/BSARg47GxjBKJ9Mz+Q3CI',
  'i21+5khjUHECIQCH1kzoKAKTnrkCuifWW9K0CzqXPLSjJBIh3jH2aaWZFQ==',
  '-----END CERTIFICATE-----',
].join('\n')

function getSslOptions() {
  // Use Timescale CA if possible so we can keep TLS verification ON.
  // You can override by setting PG_SSL_NO_VERIFY=1.
  const noVerify = String(process.env.PG_SSL_NO_VERIFY || '').toLowerCase()
  if (noVerify === '1' || noVerify === 'true' || noVerify === 'yes') {
    return { rejectUnauthorized: false }
  }

  // Prefer user-provided CA (PEM) if present, else use embedded Timescale CA.
  const ca = process.env.PG_SSL_CA_PEM || process.env.TIMESCALE_CA_PEM || TIMESCALE_CA_PEM
  return { rejectUnauthorized: true, ca }
}

function getPool() {
  if (pool) return pool

  const connectionString = getConnectionString()
  if (!connectionString) {
    throw new Error('Missing TIMESCALE_SERVICE_URL (or DATABASE_URL) env var.')
  }
  const connectionStringNormalized = normalizeConnectionString(connectionString)

  const ssl = getSslOptions()

  pool = new Pool({
    connectionString: connectionStringNormalized,
    ssl,
    max: 3,
  })

  return pool
}

async function query(text, params) {
  const p = getPool()
  return await p.query(text, params)
}

module.exports = { query }


