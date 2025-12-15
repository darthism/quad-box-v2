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

const accuracyMultiplierScaled1000 = (accuracyPercent) => {
  if (accuracyPercent === null || accuracyPercent === undefined) return 1000
  const a = Number(accuracyPercent)
  if (!Number.isFinite(a)) return 1000
  // 50% => 1x, 100% => 2x (linear). Below 50% naturally yields < 1x.
  return Math.round(clamp(a, 0, 1) * 2000)
}

const pointsForGame = ({ modalities, nBack, trialTimeMs, accuracyPercent }) => {
  const stimuliCount = Math.max(0, Math.floor(modalities * nBack))
  const base = 1n << BigInt(stimuliCount)
  const speed1000 = BigInt(speedMultiplierScaled1000(trialTimeMs))
  const acc1000 = BigInt(accuracyMultiplierScaled1000(accuracyPercent))
  // combined multiplier = (speed1000/1000) * (acc1000/1000)
  const numer = base * speed1000 * acc1000
  return (numer + 500000n) / 1000000n
}

const isEligibleForPoints = ({ status, completedTrials, matchChance }) => {
  if (status !== 'completed') return { ok: false, reason: 'not_completed' }

  const trials = Number(completedTrials)
  if (!Number.isFinite(trials) || trials < 20) return { ok: false, reason: 'min_trials' }

  // matchChance is a percent (from settings), representing expected match rate across matchable trials.
  const mc = Number(matchChance)
  if (!Number.isFinite(mc)) return { ok: false, reason: 'missing_match_rate' }
  if (mc < 20 || mc > 40) return { ok: false, reason: 'match_rate_out_of_range' }

  return { ok: true }
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
    const completedTrials = body.completedTrials === null || body.completedTrials === undefined
      ? null
      : Number(body.completedTrials)
    const matchChance = body.matchChance === null || body.matchChance === undefined
      ? null
      : Number(body.matchChance)
    const trialTimeMs = body.trialTimeMs ? Number(body.trialTimeMs) : null
    const elapsedSeconds = body.elapsedSeconds ? Number(body.elapsedSeconds) : null
    const accuracyPercent = body.accuracyPercent === null || body.accuracyPercent === undefined
      ? null
      : Number(body.accuracyPercent)

    const eligibility = isEligibleForPoints({ status, completedTrials, matchChance })
    const points = eligibility.ok
      ? pointsForGame({ modalities, nBack, trialTimeMs, accuracyPercent })
      : 0n

    const playedAt = body.timestamp ? new Date(body.timestamp) : new Date()

    await query(
      `insert into game_log
        (user_id, username, status, title, mode, nback, modalities, trial_time_ms, elapsed_seconds, accuracy, points, played_at)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        (accuracyPercent !== null && Number.isFinite(accuracyPercent)) ? clamp(accuracyPercent, 0, 1) : null,
        points.toString(),
        playedAt.toISOString(),
      ],
    )

    return json(200, { ok: true, points: points.toString(), eligibleForPoints: eligibility.ok, reason: eligibility.ok ? null : eligibility.reason })
  } catch (e) {
    if (e?.code === '42703' || String(e?.message || '').includes('does not exist')) {
      return json(500, {
        error: 'Database schema is out of date. Run POST /api/init-db (with X-Admin-Token) to add required columns, then retry.',
        code: e?.code || null,
      })
    }
    return json(e.statusCode || 500, { error: e.message || 'submit failed' })
  }
}


