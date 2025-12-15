const { query } = require('./_db.cjs')
const { json, methodNotAllowed } = require('./_http.cjs')

function requireAdmin(event) {
  const token = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token']
  const expected = process.env.ADMIN_INIT_TOKEN || ''
  if (!expected || !token || token !== expected) {
    const err = new Error('Unauthorized')
    err.statusCode = 401
    throw err
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed()

  try {
    requireAdmin(event)

    const confirm = String(event.queryStringParameters?.confirm || '').toLowerCase()
    if (confirm !== 'true' && confirm !== 'yes' && confirm !== '1') {
      return json(400, { error: 'Missing confirm=true (or yes/1) query param.' })
    }

    const delGames = await query('delete from game_log;')
    const delUsers = await query('delete from app_user;')

    return json(200, {
      ok: true,
      deleted: {
        game_log: delGames.rowCount || 0,
        app_user: delUsers.rowCount || 0,
      },
    })
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'purge failed' })
  }
}


