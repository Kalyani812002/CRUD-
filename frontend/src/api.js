// Shared fetch helper for Daymark API calls.
// VITE_API_URL selects the API origin (production: https://crud-1-xp3y.onrender.com).
// When it is empty, relative /api paths are used so the Vite dev proxy can
// forward requests to the local backend.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const result = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(result?.error ?? 'The request could not be completed.')
  return result
}
