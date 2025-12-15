const { query } = require('./_db.cjs')
const { requireUser } = require('./_auth.cjs')
const { json, methodNotAllowed, parseJsonBody } = require('./_http.cjs')

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

const inferModalities = (payload) => {
  if (typeof payload?.modalities === 'number' && Number.isFinite(payload.modalities) && payload.modalities > 0) {
    return Math.floor(payload.modalities)
  }
  if (Array.isArray(payload?.tags) && payload.tags.length > 0) return payload.tags.length
  const title = String(payload?.title ?? payload?.mode ?? '').toLowerCase()
  if (title.includes('quad')) return 4
  if (title.includes('dual')) return 2
  return 1
}

const speedMultiplierScaled1000 = (trialTimeMs) => {
  if (!trialTimeMs || !Number.isFinite(trialTimeMs) || trialTimeMs <= 0) return 1000
  const m = (2500 * 1000) / trialTimeMs
  return Math.round(clamp(m, 1000, 2000))
}

const pointsForGame = ({ modalities, nBack, trialTimeMs }) => {
  const stimuliCount = Math.max(0, Math.floor(modalities * nBack))
  const base = 1n << BigInt(stimuliCount)
  const m1000 = BigInt(speedMultiplierScaled1000(trialTimeMs))
  return (base * m1000 + 500n) / 1000n
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return methodNotAllowed()

  try {
    const claims = requireUser(event)
    const body = parseJsonBody(event)

    const status = String(body.status ?? '')
    if (!status) return json(400, { error: 'Missing status' })
    if (!['completed', 'cancelled', 'tombstone'].includes(status)) {
      return json(400, { error: 'Invalid status' })
    }

    const nBack = Number(body.nBack ?? 0)
    const modalities = inferModalities(body)
    const trialTimeMs = body.trialTimeMs ? Number(body.trialTimeMs) : null
    const elapsedSeconds = body.elapsedSeconds ? Number(body.elapsedSeconds) : null

    const points = status === 'completed'
      ? pointsForGame({ modalities, nBack, trialTimeMs })
      : 0n

    const playedAt = body.timestamp ? new Date(body.timestamp) : new Date()

    await query(
      `insert into game_log
        (user_id, username, status, title, mode, nback, modalities, trial_time_ms, elapsed_seconds, points, played_at)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        claims.sub,
        claims.username,
        status,
        body.title ?? null,
        body.mode ?? null,
        Number.isFinite(nBack) ? Math.floor(nBack) : null,
        Number.isFinite(modalities) ? Math.floor(modalities) : null,
        trialTimeMs && Number.isFinite(trialTimeMs) ? Math.floor(trialTimeMs) : null,
        elapsedSeconds && Number.isFinite(elapsedSeconds) ? elapsedSeconds : null,
        points.toString(),
        playedAt.toISOString(),
      ],
    )

    return json(200, { ok: true, points: points.toString() })
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'submit failed' })
  }
}


