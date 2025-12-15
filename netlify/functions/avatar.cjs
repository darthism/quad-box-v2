const { query } = require('./_db.cjs')
const { methodNotAllowed } = require('./_http.cjs')

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/az6k1cAAAAASUVORK5CYII=',
  'base64',
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return methodNotAllowed()

  try {
    const userId = event.queryStringParameters?.userId
    const username = event.queryStringParameters?.username

    if (!userId && !username) {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Missing userId or username' }),
      }
    }

    const result = await query(
      `select avatar_mime, avatar_bytes
       from app_user
       where ($1::uuid is not null and id = $1::uuid)
          or ($2::text is not null and username = $2::text)
       limit 1`,
      [userId ?? null, username ?? null],
    )

    const row = result.rows[0]
    if (!row?.avatar_bytes) {
      // Return a tiny transparent png so <img> tags don't break.
      return {
        statusCode: 200,
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=300',
        },
        isBase64Encoded: true,
        body: png1x1.toString('base64'),
      }
    }

    const mime = row.avatar_mime || 'image/jpeg'
    const buf = Buffer.isBuffer(row.avatar_bytes) ? row.avatar_bytes : Buffer.from(row.avatar_bytes)

    return {
      statusCode: 200,
      headers: {
        'content-type': mime,
        'cache-control': 'public, max-age=3600',
      },
      isBase64Encoded: true,
      body: buf.toString('base64'),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: e.message || 'avatar failed' }),
    }
  }
}


