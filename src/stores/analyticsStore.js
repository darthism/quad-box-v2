import { writable, get } from 'svelte/store'
import { addGame, getLastRecentGame, getPlayTimeSince4AM  } from '../lib/gamedb'
import { formatSeconds } from '../lib/utils'
import { auth } from './authStore'
import { apiFetch } from '../lib/api'

const loadAnalytics = async () => {
  const lastGame = await getLastRecentGame()
  const playTime = await getPlayTimeSince4AM()

  return {
    lastGame,
    playTime: playTime > 0 ? formatSeconds(playTime) : null,
  }
}

const createAnalyticsStore = () => {
  const { subscribe, set } = writable({})

  loadAnalytics().then(analytics => set(analytics))

  const trialTimeMsForGame = (game) => {
    if (typeof game?.trialTime === 'number' && Number.isFinite(game.trialTime) && game.trialTime > 0) {
      return game.trialTime
    }
    const avg = game?.total?.averageTrialTime
    if (typeof avg === 'number' && Number.isFinite(avg) && avg > 0) {
      return avg
    }
    return null
  }

  const submitToServer = async (game) => {
    const a = get(auth)
    if (!a?.token || !a?.user) return
    if (!game || game.status === 'tombstone') return

    try {
      await apiFetch('/api/submit-game', {
        method: 'POST',
        token: a.token,
        body: {
          status: game.status,
          title: game.title ?? null,
          mode: game.mode ?? null,
          nBack: game.nBack ?? null,
          modalities: Array.isArray(game.tags) ? game.tags.length : null,
          trialTimeMs: trialTimeMsForGame(game),
          elapsedSeconds: game.elapsedSeconds ?? null,
          accuracyPercent: (typeof game?.total?.percent === 'number' && Number.isFinite(game.total.percent)) ? game.total.percent : null,
          timestamp: game.timestamp ?? null,
        }
      })
    } catch (e) {
      // Non-fatal: offline or backend not configured yet.
      console.warn('submit-game failed', e)
    }
  }

  return {
    subscribe,
    scoreTrials: async (gameInfo, scoresheet, status) => {
      const scores = {}
      for (const tag of gameInfo.tags) {
        scores[tag] = { hits: 0, misses: 0 }
      }

      for (const answers of scoresheet) {
        for (const tag of gameInfo.tags) {
          if (tag in answers) {
            if (answers[tag]) {
              scores[tag].hits++
            } else {
              scores[tag].misses++
            }
          }
        }
      }

      await addGame({
        ...gameInfo,
        username: get(auth).user?.username ?? null,
        scores,
        completedTrials: scoresheet.length,
        status
      })
      const next = await loadAnalytics()
      set(next)
      await submitToServer(next.lastGame)
    },

    scoreTallyTrials: async (gameInfo, scoresheet, status) => {
      const scores = { tally: { hits: 0, misses: 0 } }

      scores.tally.hits = scoresheet.filter(answers => answers.success && answers.count > 0).length
      scores.tally.possible = scoresheet.filter(answers => answers.count > 0 || ('success' in answers && answers.success === false)).length

      await addGame({
        ...gameInfo,
        username: get(auth).user?.username ?? null,
        scores,
        completedTrials: scoresheet.length,
        status,
      })
      const next = await loadAnalytics()
      set(next)
      await submitToServer(next.lastGame)
    }
  }
}

export const analytics = createAnalyticsStore()