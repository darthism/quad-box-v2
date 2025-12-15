export const RANKS = [
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


