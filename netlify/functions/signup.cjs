const bcrypt = require('bcryptjs')
const { query } = require('./_db.cjs')
const { signToken } = require('./_auth.cjs')
const { json, badRequest, methodNotAllowed, parseJsonBody } = require('./_http.cjs')

function validateUsername(username) {
  const u = String(username ?? '').trim()
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) {
    const err = new Error('Username must be 3–20 characters (letters, numbers, underscore).')
    err.statusCode = 400
    throw err
  }
  return u
}

function validatePassword(password) {
  const p = String(password ?? '')
  if (p.length < 6) {
    const err = new Error('Password must be at least 6 characters.')
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

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await query(
      `insert into app_user (username, password_hash)
       values ($1, $2)
       returning id, username`,
      [username, passwordHash],
    )

    const user = result.rows[0]
    const token = signToken({ sub: user.id, username: user.username })
    return json(200, { token, user: { id: user.id, username: user.username } })
  } catch (e) {
    if (String(e.message || '').includes('duplicate key value') || e.code === '23505') {
      return badRequest('Username already exists.')
    }
    return json(e.statusCode || 500, { error: e.message || 'Signup failed' })
  }
}


