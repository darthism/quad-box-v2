<script>
  import { Trophy } from '@lucide/svelte'
  import { leaderboard } from '../stores/leaderboardStore'
  import { auth } from '../stores/authStore'
  import { analytics } from '../stores/analyticsStore'

  let show = false
  let tab = 'top'
  let message = null

  let modeFilter = 'all'
  let sortBy = 'ncalc'

  const openModal = () => {
    show = true
    message = null
  }

  const closeModal = () => {
    show = false
    message = null
  }

  const handleKeydown = (event) => {
    if (event.key === 'Escape') closeModal()
  }

  const handleBackdropClick = (event) => {
    if (event.target.classList.contains('modal')) closeModal()
  }

  const formatPercent = (p) => {
    if (typeof p !== 'number') return '—'
    return `${(p * 100).toFixed(0)}%`
  }

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ''
    }
  }

  const submitLast = () => {
    message = null
    try {
      leaderboard.submitGame($analytics.lastGame, $auth.user?.username)
      message = { kind: 'success', text: 'Submitted to leaderboard.' }
      tab = 'top'
    } catch (e) {
      message = { kind: 'error', text: e?.message ?? 'Failed to submit.' }
    }
  }

  const clearAll = () => {
    if (!confirm('Clear local leaderboard entries?')) return
    leaderboard.clear()
  }

  const filtered = (entries) => {
    let out = entries
    if (modeFilter !== 'all') {
      out = out.filter(e => (e.mode ?? e.title) === modeFilter)
    }
    return out
  }

  const sorted = (entries) => {
    const by = sortBy
    const copy = [...entries]
    copy.sort((a, b) => {
      if (by === 'percent') {
        return (b.percent ?? -1) - (a.percent ?? -1)
      }
      // ncalc is primary; fall back to percent
      const dn = (b.ncalc ?? -1) - (a.ncalc ?? -1)
      if (dn !== 0) return dn
      return (b.percent ?? -1) - (a.percent ?? -1)
    })
    return copy
  }

  $: entries = sorted(filtered($leaderboard))
  $: modes = Array.from(new Set($leaderboard.map(e => e.mode ?? e.title))).sort()
</script>

<button class="flex items-center justify-center" on:click={openModal} title="Leaderboard">
  <Trophy class="btn btn-square btn-ghost h-8 lg:h-6" />
</button>

{#if show}
  <div class="modal modal-open whitespace-normal" on:click={handleBackdropClick} on:keydown={handleKeydown} tabindex="0">
    <div class="modal-box w-[90%] max-w-4xl">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">Leaderboard</h2>
        <div class="flex gap-2 items-center">
          <select class="select select-bordered select-sm" bind:value={modeFilter}>
            <option value="all">All modes</option>
            {#each modes as m (m)}
              <option value={m}>{m}</option>
            {/each}
          </select>
          <select class="select select-bordered select-sm" bind:value={sortBy}>
            <option value="ncalc">Sort: n-calc</option>
            <option value="percent">Sort: %</option>
          </select>
        </div>
      </div>

      <div role="tablist" class="tabs tabs-lift mt-4">
        <a role="tab" class="tab" class:tab-active={tab === 'top'} on:click={() => tab = 'top'}>Top</a>
        <a role="tab" class="tab" class:tab-active={tab === 'submit'} on:click={() => tab = 'submit'}>Submit</a>
      </div>

      {#if tab === 'top'}
        <div class="mt-4 overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Mode</th>
                <th>N</th>
                <th>Score</th>
                <th>n-calc</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {#if entries.length === 0}
                <tr><td colspan="7" class="opacity-70">No entries yet.</td></tr>
              {:else}
                {#each entries.slice(0, 50) as e, idx (e.id)}
                  <tr>
                    <td>{idx + 1}</td>
                    <td class="font-semibold">{e.username}</td>
                    <td>{e.mode ?? e.title}</td>
                    <td>{e.nBack}</td>
                    <td>{formatPercent(e.percent)}</td>
                    <td>{typeof e.ncalc === 'number' ? e.ncalc.toFixed(2) : '—'}</td>
                    <td class="text-xs opacity-70">{formatDate(e.timestamp)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="mt-4 space-y-3">
          {#if !$auth.user}
            <div class="alert alert-warning">
              <span>Log in to submit scores.</span>
            </div>
          {/if}

          <div class="p-4 bg-base-200 rounded">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div class="font-semibold">Last completed game</div>
                {#if $analytics.lastGame?.status === 'completed'}
                  <div class="text-sm opacity-80">
                    {$analytics.lastGame.title} · N={$analytics.lastGame.nBack} · {formatPercent($analytics.lastGame.total?.percent)}
                    {#if typeof $analytics.lastGame.ncalc === 'number'} · n-calc={$analytics.lastGame.ncalc.toFixed(2)}{/if}
                  </div>
                {:else}
                  <div class="text-sm opacity-70">No recent completed game found.</div>
                {/if}
              </div>
              <button class="btn btn-primary" on:click={submitLast} disabled={!$auth.user || !$analytics.lastGame || $analytics.lastGame.status !== 'completed'}>
                Submit last game
              </button>
            </div>
          </div>

          {#if message}
            <div class={"alert " + (message.kind === 'error' ? 'alert-error' : 'alert-success')}>
              <span>{message.text}</span>
            </div>
          {/if}

          <div class="flex justify-between items-center">
            <button class="btn btn-error btn-sm" on:click={clearAll}>Clear local leaderboard</button>
            <div class="text-xs opacity-70">Local-only for now (stored on this device).</div>
          </div>
        </div>
      {/if}

      <div class="modal-action flex flex-row-reverse items-center justify-between mt-2">
        <button class="btn" on:click={closeModal}>Close</button>
      </div>
    </div>
  </div>
{/if}


