import { writable } from 'svelte/store'

const USERS_KEY = 'qb_users_v1'
const SESSION_KEY = 'qb_session_v1'

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const loadUsers = () => {
  const raw = localStorage.getItem(USERS_KEY)
  return raw ? safeJsonParse(raw, {}) : {}
}

const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const loadSession = () => {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? safeJsonParse(raw, null) : null
}

const saveSession = (session) => {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

const encoder = new TextEncoder()
const toBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
const fromBase64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

const randomSaltBase64 = (length = 16) => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return toBase64(bytes.buffer)
}

const pbkdf2HashBase64 = async (password, saltBase64, iterations = 100_000) => {
  if (!crypto?.subtle) {
    // Extremely degraded fallback (should be rare in modern browsers)
    return btoa(`${saltBase64}:${password}`)
  }
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const saltBytes = fromBase64(saltBase64)
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return toBase64(bits)
}

const validateUsername = (username) => {
  const normalized = username.trim()
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalized)) {
    throw new Error('Username must be 3–20 characters (letters, numbers, underscore).')
  }
  return normalized
}

const validatePassword = (password) => {
  if ((password ?? '').length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }
  return password
}

const createAuthStore = () => {
  const { subscribe, set, update } = writable({
    user: loadSession()?.user ?? null,
  })

  return {
    subscribe,

    signup: async (username, password) => {
      const u = validateUsername(username)
      const p = validatePassword(password)
      const users = loadUsers()
      if (users[u]) {
        throw new Error('Username already exists.')
      }

      const salt = randomSaltBase64()
      const hash = await pbkdf2HashBase64(p, salt)

      users[u] = { salt, hash, createdAt: Date.now() }
      saveUsers(users)

      const session = { user: { username: u }, createdAt: Date.now() }
      saveSession(session)
      set({ user: session.user })
    },

    login: async (username, password) => {
      const u = validateUsername(username)
      const p = validatePassword(password)
      const users = loadUsers()
      const record = users[u]
      if (!record) {
        throw new Error('Invalid username or password.')
      }

      const hash = await pbkdf2HashBase64(p, record.salt)
      if (hash !== record.hash) {
        throw new Error('Invalid username or password.')
      }

      const session = { user: { username: u }, createdAt: Date.now() }
      saveSession(session)
      set({ user: session.user })
    },

    logout: () => {
      saveSession(null)
      set({ user: null })
    },

    rename: (newUsername) => {
      // Convenience: allows changing display name without re-registering.
      const u = validateUsername(newUsername)
      update((state) => {
        const session = { user: { username: u }, createdAt: Date.now() }
        saveSession(session)
        return { ...state, user: session.user }
      })
    }
  }
}

export const auth = createAuthStore()


