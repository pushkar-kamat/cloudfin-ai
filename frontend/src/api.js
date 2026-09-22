function resolveApiUrl() {
  const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
  if (!configured) return `${window.location.protocol}//${window.location.hostname}:8000`

  try {
    const url = new URL(configured)
    const localHosts = new Set(['localhost', '127.0.0.1'])
    if (localHosts.has(url.hostname) && localHosts.has(window.location.hostname)) {
      url.hostname = window.location.hostname
      return url.toString().replace(/\/$/, '')
    }
  } catch {
    // fetch below will surface a clear connection error.
  }
  return configured
}

export const API_URL = resolveApiUrl()
const RETRYABLE_STATUS = new Set([502, 503, 504])
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function request(path, token, options = {}, requestConfig = {}) {
  const isForm = options.body instanceof FormData
  const maxAttempts = requestConfig.maxAttempts ?? 5
  let lastError = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          ...(isForm ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      })
    } catch {
      lastError = new Error(`Cannot reach the CloudFin backend at ${API_URL}. The Render service may be waking up or unavailable.`)
      if (attempt < maxAttempts - 1) {
        await sleep((attempt + 1) * 3000)
        continue
      }
      throw lastError
    }

    const contentType = response.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const data = isJson ? await response.json().catch(() => ({})) : {}

    if (response.ok && isJson) return data

    const retryable = RETRYABLE_STATUS.has(response.status) || !isJson
    if (retryable && attempt < maxAttempts - 1) {
      lastError = new Error('CloudFin backend is waking up. Retrying…')
      await sleep((attempt + 1) * 3000)
      continue
    }

    throw new Error(data.detail || `Request failed (${response.status})`)
  }

  throw lastError || new Error('CloudFin backend is unavailable.')
}

export const api = {
  health: () => request('/health'),
  me: (token) => request('/me', token),
  chat: (token, message, history = []) => request('/chat', token, {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  }, { maxAttempts: 1 }),
  sources: (token) => request('/sources', token),
  adminOverview: (token) => request('/admin/overview', token),
  adminReload: (token) => request('/admin/reload', token, { method: 'POST' }),
  adminUpload: (token, file) => {
    const body = new FormData()
    body.append('file', file)
    return request('/admin/documents', token, { method: 'POST', body })
  },
  adminDelete: (token, documentId) => request(`/admin/documents/${encodeURIComponent(documentId)}`, token, { method: 'DELETE' }),
  adminRetrieve: (token, query, topK = 5) => request('/admin/retrieve', token, {
    method: 'POST',
    body: JSON.stringify({ query, top_k: topK }),
  }),
}
