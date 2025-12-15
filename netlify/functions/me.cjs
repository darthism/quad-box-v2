const { query } = require('./_db.cjs')
const { requireUser } = require('./_auth.cjs')
const { json, methodNotAllowed } = require('./_http.cjs')

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return methodNotAllowed()

  try {
    const claims = requireUser(event)
    const result = await query(
      `select id, username
       from app_user
       where id = $1`,
      [claims.sub],
    )
    const user = result.rows[0]
    if (!user) return json(401, { error: 'Invalid token' })
    return json(200, { user })
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'me failed' })
  }
}


