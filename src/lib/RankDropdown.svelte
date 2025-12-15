<script>
  import { Medal } from '@lucide/svelte'
  import { RANKS, formatRankRange } from './ranks'
</script>

<div class="dropdown dropdown-end">
  <div tabindex="0" role="button" class="btn btn-square btn-ghost h-8 lg:h-6" title="Rank point ranges">
    <Medal class="h-5 w-5" />
  </div>
  <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box shadow w-72 mt-2 p-2 border border-base-300">
    <li class="menu-title"><span>Ranks (pts)</span></li>
    {#each RANKS as r (r.name)}
      <li>
        <div class="flex items-center justify-between gap-3">
          <span class={r.badge}>{r.name}</span>
          <span class="font-mono text-xs opacity-70">{formatRankRange(r)}</span>
        </div>
      </li>
    {/each}
  </ul>
</div>


