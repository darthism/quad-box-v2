const { query } = require('./_db.cjs')
const { json, methodNotAllowed } = require('./_http.cjs')

const toInt = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.floor(n) : fallback
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return methodNotAllowed()

  try {
    const category = (event.queryStringParameters?.category || 'score').toLowerCase()
    const limit = Math.max(1, Math.min(100, toInt(event.queryStringParameters?.limit, 50)))

    if (category === 'minutes') {
      const result = await query(
        `
        select
          coalesce(u.username, gl.username) as username,
          gl.user_id as user_id,
          coalesce(sum(coalesce(elapsed_seconds, 0)), 0) / 60.0 as total_minutes,
          count(*)::int as total_games,
          sum(case when status = 'completed' then 1 else 0 end)::int as completed_games,
          coalesce(sum(points), 0)::bigint as total_score,
          max(played_at) as last_played
        from game_log gl
        left join app_user u on u.id = gl.user_id
        where gl.status <> 'tombstone'
        group by coalesce(u.username, gl.username), gl.user_id
        order by total_minutes desc, total_score desc
        limit $1
        `,
        [limit],
      )

      return json(200, {
        category,
        rows: result.rows.map(r => ({
          username: r.username,
          avatarUrl: r.user_id ? `/api/avatar?userId=${encodeURIComponent(r.user_id)}` : null,
          totalMinutes: Number(r.total_minutes),
          totalGames: r.total_games,
          completedGames: r.completed_games,
          totalScore: String(r.total_score),
          lastPlayed: r.last_played,
        })),
      })
    }

    // score (default)
    const result = await query(
      `
      select
        coalesce(u.username, gl.username) as username,
        gl.user_id as user_id,
        coalesce(sum(points), 0)::bigint as total_score,
        count(*)::int as total_games,
        sum(case when status = 'completed' then 1 else 0 end)::int as completed_games,
        coalesce(sum(coalesce(elapsed_seconds, 0)), 0) / 60.0 as total_minutes,
        max(played_at) as last_played
      from game_log gl
      left join app_user u on u.id = gl.user_id
      where gl.status <> 'tombstone'
      group by coalesce(u.username, gl.username), gl.user_id
      order by total_score desc, total_minutes desc
      limit $1
      `,
      [limit],
    )

    return json(200, {
      category: 'score',
      rows: result.rows.map(r => ({
        username: r.username,
        avatarUrl: r.user_id ? `/api/avatar?userId=${encodeURIComponent(r.user_id)}` : null,
        totalScore: String(r.total_score),
        totalGames: r.total_games,
        completedGames: r.completed_games,
        totalMinutes: Number(r.total_minutes),
        lastPlayed: r.last_played,
      })),
    })
  } catch (e) {
    return json(500, { error: e.message || 'leaderboard failed' })
  }
}


