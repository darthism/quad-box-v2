export const RANKS = [
  // Text-only colors (no badge background). Use Tailwind text colors for consistent visibility.
  { name: 'Adept', min: 0n, max: 250n, textClass: 'font-semibold text-slate-400' },
  { name: 'Scholar', min: 250n, max: 750n, textClass: 'font-semibold text-sky-400' },
  { name: 'Savant', min: 750n, max: 1750n, textClass: 'font-semibold text-blue-500' },
  { name: 'Expert', min: 1750n, max: 3750n, textClass: 'font-semibold text-violet-500' },
  { name: 'Mastermind', min: 3750n, max: 7750n, textClass: 'font-semibold text-fuchsia-500' },
  { name: 'Visionary', min: 7750n, max: 15750n, textClass: 'font-semibold text-cyan-500' },
  { name: 'Genius', min: 15750n, max: 31750n, textClass: 'font-semibold text-emerald-500' },
  { name: 'Virtuoso', min: 31750n, max: 63750n, textClass: 'font-semibold text-amber-500' },
  { name: 'Luminary', min: 63750n, max: 127750n, textClass: 'font-semibold text-rose-500' },
  { name: 'Prodigy', min: 127750n, max: 255750n, textClass: 'font-semibold text-indigo-500' },
  { name: 'Oracle', min: 255750n, max: 511750n, textClass: 'font-semibold text-purple-500' },
  { name: 'Sage', min: 511750n, max: 1023750n, textClass: 'font-semibold text-teal-500' },
  { name: 'Philosopher', min: 1023750n, max: 2047750n, textClass: 'font-semibold text-sky-300' },
  { name: 'Mystic', min: 2047750n, max: 4095750n, textClass: 'font-semibold text-lime-500' },
  { name: 'Transcendent', min: 4095750n, max: null, textClass: 'font-semibold text-orange-500' },
]

export function rankForScore(score) {
  const s = typeof score === 'bigint' ? score : 0n
  for (const r of RANKS) {
    if (s < r.min) continue
    if (r.max === null || s < r.max) return r
  }
  return RANKS[0]
}

export function formatBigInt(n) {
  try {
    const s = (n ?? 0n).toString()
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  } catch {
    return '0'
  }
}

export function formatRankRange(rank) {
  if (!rank) return ''
  const min = formatBigInt(rank.min)
  if (rank.max === null) return `${min}+ pts`
  return `${min}–${formatBigInt(rank.max)} pts`
}


