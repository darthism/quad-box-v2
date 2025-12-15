import { writable } from 'svelte/store'

const LEADERBOARD_KEY = 'qb_leaderboard_v1'

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const loadEntries = () => {
  const raw = localStorage.getItem(LEADERBOARD_KEY)
  return raw ? safeJsonParse(raw, []) : []
}

const saveEntries = (entries) => {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries))
}

const normalizeEntry = (entry) => {
  return {
    id: entry.id ?? `${entry.username}-${entry.timestamp}-${Math.random().toString(16).slice(2)}`,
    username: entry.username,
    title: entry.title,
    nBack: entry.nBack,
    mode: entry.mode ?? entry.title,
    percent: entry.percent,
    ncalc: entry.ncalc ?? null,
    elapsedSeconds: entry.elapsedSeconds ?? null,
    timestamp: entry.timestamp,
  }
}

const createLeaderboardStore = () => {
  const { subscribe, set, update } = writable(loadEntries())

  return {
    subscribe,

    submitGame: (game, username) => {
      if (!game) throw new Error('No game to submit.')
      if (!username) throw new Error('You must be logged in to submit.')
      if (game.status !== 'completed') throw new Error('Only completed games can be submitted.')

      const entry = normalizeEntry({
        username,
        title: game.title,
        mode: game.mode ?? game.title,
        nBack: game.nBack,
        percent: game.total?.percent ?? null,
        ncalc: game.ncalc ?? null,
        elapsedSeconds: game.elapsedSeconds ?? null,
        timestamp: game.timestamp ?? Date.now(),
      })

      update((entries) => {
        const next = [entry, ...entries].slice(0, 200)
        saveEntries(next)
        return next
      })
    },

    clear: () => {
      saveEntries([])
      set([])
    },
  }
}

export const leaderboard = createLeaderboardStore()


