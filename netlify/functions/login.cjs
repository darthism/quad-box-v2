const bcrypt = require('bcryptjs')
const { query } = require('./_db.cjs')
const { signToken } = require('./_auth.cjs')
const { json, badRequest, methodNotAllowed, parseJsonBody } = require('./_http.cjs')

function validateUsername(username) {
  const u = String(username ?? '').trim()
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) {
    const err = new Error('Invalid username or password.')
    err.statusCode = 400
    throw err
  }
  return u
}

function validatePassword(password) {
  const p = String(password ?? '')
  if (p.length < 6) {
    const err = new Error('Invalid username or password.')
    err.statusCode = 400
    throw err
  }
  return p
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed()

  try {
    const body = parseJsonBody(event)
    const username = validateUsername(body.username)
    const password = validatePassword(body.password)

    const result = await query(
      `select id, username, password_hash
       from app_user
       where username = $1`,
      [username],
    )

    const row = result.rows[0]
    if (!row) return badRequest('Invalid username or password.')

    const ok = await bcrypt.compare(password, row.password_hash)
    if (!ok) return badRequest('Invalid username or password.')

    const token = signToken({ sub: row.id, username: row.username })
    return json(200, { token, user: { id: row.id, username: row.username } })
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'Login failed' })
  }
}


