const { query } = require('./_db.cjs')
const { requireUser, signToken } = require('./_auth.cjs')
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

function parseAvatarDataUrl(dataUrl) {
  const s = String(dataUrl ?? '')
  const m = s.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) {
    const err = new Error('Avatar must be a PNG, JPEG, or WebP image.')
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
  if (buf.length > 256 * 1024) {
    const err = new Error('Avatar image is too large. Please upload a smaller image.')
    err.statusCode = 400
    throw err
  }
  return { mime, buf }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
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
      return json(200, {
        user,
        avatarUrl: `/api/avatar?userId=${encodeURIComponent(user.id)}`,
      })
    } catch (e) {
      return json(e.statusCode || 500, { error: e.message || 'profile failed' })
    }
  }

  if (event.httpMethod !== 'PATCH') return methodNotAllowed()

  try {
    const claims = requireUser(event)
    const body = parseJsonBody(event)

    const wantsUsername = typeof body.username === 'string' && body.username.trim().length > 0
    const wantsAvatar = typeof body.avatarDataUrl === 'string' && body.avatarDataUrl.trim().length > 0

    if (!wantsUsername && !wantsAvatar) {
      return badRequest('Nothing to update.')
    }

    const current = await query(
      `select id, username
       from app_user
       where id = $1`,
      [claims.sub],
    )
    const row = current.rows[0]
    if (!row) return json(401, { error: 'Invalid token' })

    let newUsername = row.username
    let newToken = null

    if (wantsUsername) {
      newUsername = validateUsername(body.username)

      const nameOk = await checkUsernameSfw(newUsername)
      if (!nameOk.ok) return badRequest(nameOk.reason || 'Username rejected.')

      if (newUsername !== row.username) {
        // Uniqueness check
        const existing = await query(`select 1 from app_user where username = $1`, [newUsername])
        if (existing.rows.length > 0) return badRequest('Username already exists.')

        await query(`update app_user set username = $1 where id = $2`, [newUsername, row.id])
        // Keep denormalized username in sync for existing data / debugging.
        await query(`update game_log set username = $1 where user_id = $2`, [newUsername, row.id])

        // Issue a new token so future submits include the right username claim.
        newToken = signToken({ sub: row.id, username: newUsername })
      }
    }

    if (wantsAvatar) {
      const { mime, buf } = parseAvatarDataUrl(body.avatarDataUrl)
      const avatarOk = await checkAvatarSfw(buf, mime)
      if (!avatarOk.ok) return badRequest(avatarOk.reason || 'Avatar rejected.')
      await query(`update app_user set avatar_mime = $1, avatar_bytes = $2 where id = $3`, [mime, buf, row.id])
    }

    const user = { id: row.id, username: newUsername }
    return json(200, {
      ok: true,
      user,
      token: newToken,
      avatarUrl: `/api/avatar?userId=${encodeURIComponent(user.id)}`,
    })
  } catch (e) {
    if (e?.code === '42703' || String(e?.message || '').includes('does not exist')) {
      return json(500, {
        error: 'Database schema is out of date. Run POST /api/init-db (with X-Admin-Token) to add required columns, then retry.',
        code: e?.code || null,
      })
    }
    if (e?.code === '23505') return badRequest('Username already exists.')
    return json(e.statusCode || 500, { error: e.message || 'profile update failed' })
  }
}


