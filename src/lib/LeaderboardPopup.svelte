<script>
  import { Trophy } from '@lucide/svelte'
  import { getAllGames } from './gamedb'

  let show = false
  let tab = 'minutes'
  let loading = false
  let error = null

  let stats = []

  const openModal = () => {
    show = true
    void load()
  }

  const closeModal = () => {
    show = false
    error = null
  }

  const handleKeydown = (event) => {
    if (event.key === 'Escape') closeModal()
  }

  const handleBackdropClick = (event) => {
    if (event.target.classList.contains('modal')) closeModal()
  }

  const formatMinutes = (minutes) => {
    if (typeof minutes !== 'number') return '—'
    return minutes.toFixed(minutes >= 10 ? 0 : 1)
  }

  const formatBigInt = (n) => {
    try {
      const s = (n ?? 0n).toString()
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    } catch {
      return '0'
    }
  }

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ''
    }
  }

  const inferModalities = (game) => {
    if (Array.isArray(game?.tags) && game.tags.length > 0) return game.tags.length
    const title = (game?.title ?? '').toLowerCase()
    if (title.includes('quad')) return 4
    if (title.includes('dual')) return 2
    return 1
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

  const trialTimeMsForGame = (game) => {
    // Most modes store a fixed trial time in ms.
    if (typeof game?.trialTime === 'number' && Number.isFinite(game.trialTime) && game.trialTime > 0) {
      return game.trialTime
    }

    // Tally modes don't have a fixed timer, but we compute an average trial time in addScoreMetadata.
    const avg = game?.total?.averageTrialTime
    if (typeof avg === 'number' && Number.isFinite(avg) && avg > 0) {
      return avg
    }

    return null
  }

  const speedMultiplierScaled1000 = (game) => {
    // Spec: 1× at 2.5s, up to 2× at 1.25s.
    // We model this as multiplier = clamp(2.5s / trialSeconds, 1, 2).
    // Return scaled integer (x1000) so we can keep points as BigInt.
    const ms = trialTimeMsForGame(game)
    if (!ms) return 1000

    const m = (2500 * 1000) / ms
    return Math.round(clamp(m, 1000, 2000))
  }

  const pointsForGame = (game) => {
    // Default points gained per completed game is 2^(stimuliCount)
    // stimuliCount = modalities * nBack
    const modalities = inferModalities(game)
    const nBack = Number(game?.nBack ?? 0)
    const stimuliCount = Math.max(0, Math.floor(modalities * nBack))
    const base = 1n << BigInt(stimuliCount)

    // Multiply by trial-speed factor (scaled by 1000, rounded to nearest int point).
    const m1000 = BigInt(speedMultiplierScaled1000(game))
    return (base * m1000 + 500n) / 1000n
  }

  const RANKS = [
    { name: 'Adept', min: 0n, max: 250n, badge: 'badge badge-ghost' },
    { name: 'Scholar', min: 250n, max: 750n, badge: 'badge badge-neutral' },
    { name: 'Savant', min: 750n, max: 1750n, badge: 'badge badge-primary' },
    { name: 'Expert', min: 1750n, max: 3750n, badge: 'badge badge-secondary' },
    { name: 'Mastermind', min: 3750n, max: 7750n, badge: 'badge badge-accent' },
    { name: 'Visionary', min: 7750n, max: 15750n, badge: 'badge badge-info' },
    { name: 'Genius', min: 15750n, max: 31750n, badge: 'badge badge-success' },
    { name: 'Virtuoso', min: 31750n, max: 63750n, badge: 'badge badge-warning' },
    { name: 'Luminary', min: 63750n, max: 127750n, badge: 'badge badge-error' },
    { name: 'Prodigy', min: 127750n, max: 255750n, badge: 'badge badge-outline badge-primary' },
    { name: 'Oracle', min: 255750n, max: 511750n, badge: 'badge badge-outline badge-secondary' },
    { name: 'Sage', min: 511750n, max: 1023750n, badge: 'badge badge-outline badge-accent' },
    { name: 'Philosopher', min: 1023750n, max: 2047750n, badge: 'badge badge-outline badge-info' },
    { name: 'Mystic', min: 2047750n, max: 4095750n, badge: 'badge badge-outline badge-success' },
    { name: 'Transcendent', min: 4095750n, max: null, badge: 'badge badge-outline badge-warning' },
  ]

  const rankForScore = (score) => {
    const s = typeof score === 'bigint' ? score : 0n
    for (const r of RANKS) {
      if (s < r.min) continue
      if (r.max === null || s < r.max) return r
    }
    return RANKS[0]
  }

  const load = async () => {
    loading = true
    error = null
    try {
      const games = await getAllGames()
      const map = new Map()

      for (const g of games) {
        if (!g || g.status === 'tombstone') continue
        const username = (g.username && String(g.username).trim()) ? String(g.username).trim() : 'anonymous'
        if (!map.has(username)) {
          map.set(username, {
            username,
            totalMinutes: 0,
            totalScore: 0n,
            totalGames: 0,
            completedGames: 0,
            lastPlayed: null,
          })
        }
        const row = map.get(username)
        row.totalGames += 1
        row.totalMinutes += (g.elapsedSeconds ?? 0) / 60
        row.lastPlayed = row.lastPlayed ? Math.max(row.lastPlayed, g.timestamp ?? 0) : (g.timestamp ?? 0)
        if (g.status === 'completed') {
          row.completedGames += 1
          row.totalScore += pointsForGame(g)
        }
      }

      stats = Array.from(map.values())
    } catch (e) {
      error = e?.message ?? 'Failed to load leaderboard.'
    } finally {
      loading = false
    }
  }

  $: minutesRows = [...stats].sort((a, b) => (b.totalMinutes ?? 0) - (a.totalMinutes ?? 0))
  $: scoreRows = [...stats].sort((a, b) => {
    const diff = (b.totalScore ?? 0n) - (a.totalScore ?? 0n)
    if (diff !== 0n) return diff > 0n ? 1 : -1
    return (b.totalMinutes ?? 0) - (a.totalMinutes ?? 0)
  })
</script>

<button class="flex items-center justify-center" on:click={openModal} title="Leaderboard">
  <Trophy class="btn btn-square btn-ghost h-8 lg:h-6" />
</button>

{#if show}
  <div class="modal modal-open whitespace-normal" on:click={handleBackdropClick} on:keydown={handleKeydown} tabindex="0">
    <div class="modal-box w-[90%] max-w-4xl">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">Leaderboard</h2>
        <button class="btn btn-sm" on:click={load} disabled={loading}>Refresh</button>
      </div>

      <div role="tablist" class="tabs tabs-lift mt-4">
        <a role="tab" class="tab" class:tab-active={tab === 'minutes'} on:click={() => tab = 'minutes'}>Total minutes played</a>
        <a role="tab" class="tab" class:tab-active={tab === 'score'} on:click={() => tab = 'score'}>Total score</a>
      </div>

      {#if error}
        <div class="alert alert-error mt-4"><span>{error}</span></div>
      {/if}

      {#if loading}
        <div class="mt-4 opacity-70">Loading…</div>
      {:else if tab === 'minutes'}
        <div class="mt-4 overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Rank</th>
                <th>Minutes</th>
                <th>Total games</th>
                <th>Completed</th>
                <th>Last played</th>
              </tr>
            </thead>
            <tbody>
              {#if minutesRows.length === 0}
                <tr><td colspan="7" class="opacity-70">No games yet.</td></tr>
              {:else}
                {#each minutesRows.slice(0, 50) as r, idx (r.username)}
                  {@const rank = rankForScore(r.totalScore)}
                  <tr>
                    <td>{idx + 1}</td>
                    <td class="font-semibold">{r.username}</td>
                    <td><span class={rank.badge}>{rank.name}</span></td>
                    <td>{formatMinutes(r.totalMinutes)}</td>
                    <td>{r.totalGames}</td>
                    <td>{r.completedGames}</td>
                    <td class="text-xs opacity-70">{r.lastPlayed ? formatDate(r.lastPlayed) : '—'}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="mt-4 overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Rank</th>
                <th>Pts</th>
                <th>Completed</th>
                <th>Total games</th>
                <th>Last played</th>
              </tr>
            </thead>
            <tbody>
              {#if scoreRows.length === 0}
                <tr><td colspan="7" class="opacity-70">No games yet.</td></tr>
              {:else}
                {#each scoreRows.slice(0, 50) as r, idx (r.username)}
                  {@const rank = rankForScore(r.totalScore)}
                  <tr>
                    <td>{idx + 1}</td>
                    <td class="font-semibold">{r.username}</td>
                    <td><span class={rank.badge}>{rank.name}</span></td>
                    <td class="font-mono">{formatBigInt(r.totalScore)}</td>
                    <td>{r.completedGames}</td>
                    <td>{r.totalGames}</td>
                    <td class="text-xs opacity-70">{r.lastPlayed ? formatDate(r.lastPlayed) : '—'}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="modal-action flex flex-row-reverse items-center justify-between mt-2">
        <button class="btn" on:click={closeModal}>Close</button>
        <div class="text-xs opacity-70">
          Pts per completed game = 2^(modalities × nBack) × speed multiplier (1× at 2.5s → 2× at 1.25s).
        </div>
      </div>
    </div>
  </div>
{/if}


