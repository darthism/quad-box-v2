const DEFAULT_TIMEOUT_MS = 6000

const withTimeout = async (fn, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fn(ctrl.signal)
  } finally {
    clearTimeout(t)
  }
}

const getCreds = () => {
  const apiUser = process.env.SIGHTENGINE_USER || ''
  const apiSecret = process.env.SIGHTENGINE_SECRET || ''
  if (!apiUser || !apiSecret) {
    const err = new Error('Missing Sightengine credentials (SIGHTENGINE_USER / SIGHTENGINE_SECRET).')
    err.statusCode = 500
    throw err
  }
  return { apiUser, apiSecret }
}

exports.checkUsernameSfw = async (username) => {
  const { apiUser, apiSecret } = getCreds()
  const text = String(username ?? '').trim()
  if (!text) return { ok: false, reason: 'Empty username' }

  const url = new URL('https://api.sightengine.com/1.0/text/check.json')
  url.search = new URLSearchParams({
    text,
    mode: 'standard',
    lang: 'en',
    api_user: apiUser,
    api_secret: apiSecret,
  }).toString()

  const data = await withTimeout(async (signal) => {
    const res = await fetch(url.toString(), { method: 'GET', signal })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(`Sightengine text check failed (HTTP ${res.status})`)
      err.statusCode = 502
      err.data = json
      throw err
    }
    return json
  })

  const matches = data?.profanity?.matches
  if (Array.isArray(matches) && matches.length > 0) {
    return { ok: false, reason: 'Username contains profanity.' }
  }

  return { ok: true }
}

exports.checkAvatarSfw = async (buffer, mime) => {
  const { apiUser, apiSecret } = getCreds()

  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp'])
  if (!allowed.has(mime)) return { ok: false, reason: 'Avatar must be PNG, JPEG, or WebP.' }

  const fd = new FormData()
  fd.set('models', 'nudity-2.1,wad,gore')
  fd.set('api_user', apiUser)
  fd.set('api_secret', apiSecret)
  fd.set('media', new Blob([buffer], { type: mime }), 'avatar')

  const data = await withTimeout(async (signal) => {
    const res = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: fd,
      signal,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(`Sightengine image check failed (HTTP ${res.status})`)
      err.statusCode = 502
      err.data = json
      throw err
    }
    return json
  })

  // Conservative SFW checks: block if high confidence on explicit content / gore / weapons / alcohol / drugs.
  const nudity = data?.nudity || {}
  const nudityBad = Math.max(
    Number(nudity.sexual_activity ?? 0),
    Number(nudity.sexual_display ?? 0),
    Number(nudity.erotica ?? 0),
    Number(nudity.very_suggestive ?? 0),
  )

  const gore = data?.gore
  const goreProb = Number(gore?.prob ?? gore ?? 0)

  const wad = data?.wad || {}
  const wadBad = Math.max(
    Number(wad.weapon ?? 0),
    Number(wad.alcohol ?? 0),
    Number(wad.drugs ?? 0),
  )

  // Thresholds tuned for avatars: allow normal faces, block clear NSFW.
  if (Number.isFinite(nudityBad) && nudityBad >= 0.20) return { ok: false, reason: 'Avatar failed nudity check.' }
  if (Number.isFinite(goreProb) && goreProb >= 0.20) return { ok: false, reason: 'Avatar failed gore check.' }
  if (Number.isFinite(wadBad) && wadBad >= 0.30) return { ok: false, reason: 'Avatar failed weapons/alcohol/drugs check.' }

  return { ok: true }
}


