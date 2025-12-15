const jwt = require('jsonwebtoken')

function getJwtSecret() {
  return process.env.JWT_SECRET || ''
}

function signToken(payload) {
  const secret = getJwtSecret()
  if (!secret) throw new Error('Missing JWT_SECRET env var.')
  return jwt.sign(payload, secret, { expiresIn: '30d' })
}

function verifyToken(token) {
  const secret = getJwtSecret()
  if (!secret) throw new Error('Missing JWT_SECRET env var.')
  return jwt.verify(token, secret)
}

function getBearerToken(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization
  if (!auth) return null
  const m = String(auth).match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

function requireUser(event) {
  const token = getBearerToken(event)
  if (!token) {
    const err = new Error('Missing Authorization: Bearer token')
    err.statusCode = 401
    throw err
  }
  try {
    return verifyToken(token)
  } catch {
    const err = new Error('Invalid token')
    err.statusCode = 401
    throw err
  }
}

module.exports = { signToken, requireUser }


