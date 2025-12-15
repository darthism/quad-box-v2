export async function apiFetch(path, { method = 'GET', token, body } = {}) {
  const headers = {
    'accept': 'application/json',
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  if (token) {
    headers['authorization'] = `Bearer ${token}`
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const message = (data && typeof data === 'object' && data.error) ? data.error : `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}


