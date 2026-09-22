const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function request(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.detail || 'Request failed')
  return data
}

export const api = {
  chat: (token, message) => request('/chat', token, { method: 'POST', body: JSON.stringify({ message }) }),
  sources: (token) => request('/sources', token),
  reload: (token) => request('/admin/reload', token, { method: 'POST' }),
  health: () => request('/health'),
}
