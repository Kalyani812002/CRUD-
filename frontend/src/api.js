// Shared fetch helper for Daymark API calls (relative /api paths; Vite proxies in dev).
export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const result = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(result?.error ?? 'The request could not be completed.')
  return result
}
