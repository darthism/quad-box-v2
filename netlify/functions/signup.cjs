const bcrypt = require('bcryptjs')
const { query } = require('./_db.cjs')
const { signToken } = require('./_auth.cjs')
const { json, badRequest, methodNotAllowed, parseJsonBody } = require('./_http.cjs')
const { checkUsernameSfw, checkAvatarSfw } = require('./_sightengine.cjs')

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

function parseAvatarDataUrl(dataUrl) {
  const s = String(dataUrl ?? '')
  const m = s.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) {
    const err = new Error('Avatar is required and must be a PNG, JPEG, or WebP image.')
    err.statusCode = 400
    throw err
  }
  const mime = m[1]
  const b64 = m[2]
  const buf = Buffer.from(b64, 'base64')
  if (!buf || buf.length === 0) {
    const err = new Error('Avatar image is empty.')
    err.statusCode = 400
    throw err
  }
  // Keep avatars small; client will resize/compress.
  if (buf.length > 256 * 1024) {
    const err = new Error('Avatar image is too large. Please upload a smaller image.')
    err.statusCode = 400
    throw err
  }
  return { mime, buf }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed()

  try {
    const body = parseJsonBody(event)
    const username = validateUsername(body.username)
    const password = validatePassword(body.password)
    const { mime: avatarMime, buf: avatarBytes } = parseAvatarDataUrl(body.avatarDataUrl)

    const nameOk = await checkUsernameSfw(username)
    if (!nameOk.ok) return badRequest(nameOk.reason || 'Username rejected.')

    const avatarOk = await checkAvatarSfw(avatarBytes, avatarMime)
    if (!avatarOk.ok) return badRequest(avatarOk.reason || 'Avatar rejected.')

    const passwordHash = await bcrypt.hash(password, 10)

    const result = await query(
      `insert into app_user (username, password_hash, avatar_mime, avatar_bytes)
       values ($1, $2, $3, $4)
       returning id, username`,
      [username, passwordHash, avatarMime, avatarBytes],
    )

    const user = result.rows[0]
    const token = signToken({ sub: user.id, username: user.username })
    return json(200, { token, user: { id: user.id, username: user.username } })
  } catch (e) {
    if (e?.code === '42703' || String(e?.message || '').includes('does not exist')) {
      // DB schema is older than the code. Run init-db to apply ALTER TABLE migrations.
      return json(500, {
        error: 'Database schema is out of date. Run POST /api/init-db (with X-Admin-Token) to add required columns, then retry signup.',
        code: e?.code || null,
      })
    }
    if (String(e.message || '').includes('duplicate key value') || e.code === '23505') {
      return badRequest('Username already exists.')
    }
    return json(e.statusCode || 500, { error: e.message || 'Signup failed' })
  }
}


