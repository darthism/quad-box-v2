<script>
  import { Trophy } from '@lucide/svelte'
  import { apiFetch } from '../lib/api'
  import { rankForScore, formatBigInt as formatBigIntShared } from './ranks'

  let show = false
  let tab = 'minutes'
  let loading = false
  let error = null

  let rows = []

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

  const formatBigInt = (n) => formatBigIntShared(n)

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ''
    }
  }

  const parseBigInt = (value) => {
    try {
      return BigInt(value ?? 0)
    } catch {
      return 0n
    }
  }

  // ranks are shared (see src/lib/ranks.js)

  const load = async () => {
    loading = true
    error = null
    try {
      const data = await apiFetch(`/api/leaderboard?category=${encodeURIComponent(tab)}&limit=50`)
      rows = Array.isArray(data?.rows) ? data.rows : []
    } catch (e) {
      error = e?.message ?? 'Failed to load leaderboard.'
    } finally {
      loading = false
    }
  }

  $: displayedRows = rows
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
        <a role="tab" class="tab" class:tab-active={tab === 'minutes'} on:click={() => { tab = 'minutes'; void load() }}>Total minutes played</a>
        <a role="tab" class="tab" class:tab-active={tab === 'score'} on:click={() => { tab = 'score'; void load() }}>Total score</a>
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
              {#if displayedRows.length === 0}
                <tr><td colspan="7" class="opacity-70">No games yet.</td></tr>
              {:else}
                {#each displayedRows as r, idx (r.username)}
                  {@const rank = rankForScore(parseBigInt(r.totalScore))}
                  <tr>
                    <td>{idx + 1}</td>
                    <td class="font-semibold">
                      <div class="flex items-center gap-2">
                        <img
                          class="w-8 h-8 rounded-full ring-1 ring-base-content/10"
                          alt=""
                          loading="lazy"
                          src={r.avatarUrl || '/quadbox.svg'}
                        />
                        <span>{r.username}</span>
                      </div>
                    </td>
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
              {#if displayedRows.length === 0}
                <tr><td colspan="7" class="opacity-70">No games yet.</td></tr>
              {:else}
                {#each displayedRows as r, idx (r.username)}
                  {@const rank = rankForScore(parseBigInt(r.totalScore))}
                  <tr>
                    <td>{idx + 1}</td>
                    <td class="font-semibold">
                      <div class="flex items-center gap-2">
                        <img
                          class="w-8 h-8 rounded-full ring-1 ring-base-content/10"
                          alt=""
                          loading="lazy"
                          src={r.avatarUrl || '/quadbox.svg'}
                        />
                        <span>{r.username}</span>
                      </div>
                    </td>
                    <td><span class={rank.badge}>{rank.name}</span></td>
                    <td class="font-mono">{formatBigInt(parseBigInt(r.totalScore))}</td>
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
          Global leaderboard (server-side). Pts are computed server-side per completed game.
        </div>
      </div>
    </div>
  </div>
{/if}


