const json = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

const badRequest = (message) => json(400, { error: message })
const unauthorized = (message) => json(401, { error: message })
const methodNotAllowed = () => json(405, { error: 'Method not allowed' })

const parseJsonBody = (event) => {
  if (!event.body) return {}
  try {
    return JSON.parse(event.body)
  } catch {
    const err = new Error('Invalid JSON body')
    err.statusCode = 400
    throw err
  }
}

module.exports = { json, badRequest, unauthorized, methodNotAllowed, parseJsonBody }


