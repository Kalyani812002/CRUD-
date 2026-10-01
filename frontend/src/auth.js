// Frontend-only session helper for the Daymark login gate.
// Credentials are checked in the browser — treat this as a UI gate, not real security.

const LOGIN_USERNAME = 'admin'
const LOGIN_PASSWORD = 'admin123'
const SESSION_KEY = 'daymark.session'
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // keep users signed in for 7 days

export { LOGIN_USERNAME, LOGIN_PASSWORD }

export async function signIn(username, password) {
  // Small delay so the button state behaves like a real sign-in request.
  await new Promise((resolve) => setTimeout(resolve, 350))

  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : ''
  const submittedPassword = typeof password === 'string' ? password : ''

  if (normalizedUsername !== LOGIN_USERNAME || submittedPassword !== LOGIN_PASSWORD) {
    throw new Error('Incorrect username or password. Please try again.')
  }

  return persistSession({ username: LOGIN_USERNAME, isAdmin: true, signedInAt: Date.now() })
}

export function readSession() {
  try {
    const rawSession = localStorage.getItem(SESSION_KEY)
    if (!rawSession) return null

    const session = JSON.parse(rawSession)
    if (!session || typeof session.username !== 'string' || typeof session.signedInAt !== 'number') return null
    if (session.provider === 'google') {
      if (typeof session.email !== 'string' || !session.email) return null
    } else if (session.provider !== 'credentials' && session.username !== LOGIN_USERNAME) return null
    if (Date.now() - session.signedInAt > SESSION_MAX_AGE_MS) {
      clearSession()
      return null
    }
    return {
      ...session,
      // Normalise the admin flag so sessions created before user management
      // (and any malformed copy) still resolve to the right access level.
      isAdmin: session.isAdmin === true
        || (session.provider !== 'google' && session.username === LOGIN_USERNAME),
    }
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/* ---------- Google social login (Google Identity Services) ----------
   The ID token returned by Google's button is a signed JWT. We verify the
   RS256 signature against Google's published JWKS in the browser and check
   the issuer, audience and expiry before creating a session.            */

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])
const GOOGLE_CONFIG_ERROR = 'Google sign-in is not configured for this app.'
const GOOGLE_VERIFY_ERROR = 'Google sign-in could not be verified. Please try again.'
const GOOGLE_SECURE_ERROR = 'Google sign-in requires a secure (HTTPS) connection.'

function persistSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable — the session still lasts for this page visit.
  }
  return session
}

let googleKeysRequest = null

function requestGoogleKeys() {
  return fetch(GOOGLE_JWKS_URL).then(async (response) => {
    if (!response.ok) throw new Error('Google signing keys could not be fetched.')
    const jwks = await response.json()
    return Array.isArray(jwks.keys) ? jwks.keys : []
  })
}

async function loadGoogleKeys(refresh = false) {
  if (refresh || !googleKeysRequest) {
    const pendingRequest = requestGoogleKeys()
    googleKeysRequest = pendingRequest
    try {
      return await pendingRequest
    } catch (error) {
      if (googleKeysRequest === pendingRequest) googleKeysRequest = null
      throw error
    }
  }
  return googleKeysRequest
}

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function decodeJwtSegment(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)))
}

/**
 * Verify a Google ID token and return the profile it carries.
 * Signature (RS256 against Google's JWKS), issuer, audience and expiry are checked.
 * `keys` may be injected for tests; otherwise they are fetched from Google.
 */
export async function verifyGoogleIdToken(idToken, clientId, { keys } = {}) {
  if (typeof clientId !== 'string' || !clientId.trim()) throw new Error(GOOGLE_CONFIG_ERROR)
  if (typeof idToken !== 'string' || !idToken) {
    throw new Error('Google sign-in did not complete. Please try again.')
  }
  if (!globalThis.crypto?.subtle) throw new Error(GOOGLE_SECURE_ERROR)

  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error(GOOGLE_VERIFY_ERROR)
  const [encodedHeader, encodedPayload, encodedSignature] = parts

  let header
  let payload
  try {
    header = decodeJwtSegment(encodedHeader)
    payload = decodeJwtSegment(encodedPayload)
  } catch {
    throw new Error(GOOGLE_VERIFY_ERROR)
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const audience = payload.aud
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(clientId)
    : audience === clientId

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error(GOOGLE_VERIFY_ERROR)
  if (!GOOGLE_ISSUERS.has(payload.iss)) throw new Error(GOOGLE_VERIFY_ERROR)
  if (!audienceMatches) throw new Error(GOOGLE_VERIFY_ERROR)
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Your Google sign-in has expired. Please try again.')
  }
  if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email) {
    throw new Error(GOOGLE_VERIFY_ERROR)
  }

  let signingKeys = keys ?? (await loadGoogleKeys())
  let signingKey = signingKeys.find((candidate) => candidate?.kid === header.kid)
  if (!signingKey && !keys) {
    // The cached key set may have rotated — refresh it once.
    signingKeys = await loadGoogleKeys(true)
    signingKey = signingKeys.find((candidate) => candidate?.kid === header.kid)
  }
  if (!signingKey) throw new Error(GOOGLE_VERIFY_ERROR)

  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      signingKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const signature = base64UrlToBytes(encodedSignature)
    const signedData = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    const isSignatureValid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      signedData,
    )
    if (!isSignatureValid) throw new Error(GOOGLE_VERIFY_ERROR)
  } catch (error) {
    if (error?.message === GOOGLE_VERIFY_ERROR) throw error
    throw new Error(GOOGLE_VERIFY_ERROR)
  }

  return {
    email: payload.email,
    name: typeof payload.name === 'string' && payload.name.trim() ? payload.name : payload.email,
    picture: typeof payload.picture === 'string' ? payload.picture : '',
  }
}

export async function signInWithGoogle(idToken, clientId, options) {
  const profile = await verifyGoogleIdToken(idToken, clientId, options)
  return persistSession({
    provider: 'google',
    username: profile.name,
    email: profile.email,
    picture: profile.picture,
    isAdmin: false,
    signedInAt: Date.now(),
  })
}

// Sign in with an account created from the Users page (POST /api/auth/login).
export async function signInWithCredentials(username, password) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : ''
  const submittedPassword = typeof password === 'string' ? password : ''
  if (!normalizedUsername || !submittedPassword) {
    throw new Error('Username and password are required.')
  }

  let response
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalizedUsername, password: submittedPassword }),
    })
  } catch {
    throw new Error('We could not reach the server. Please try again.')
  }

  const result = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(result?.error ?? 'Sign-in failed. Please try again.')
  }
  if (!result || typeof result.username !== 'string' || typeof result.role !== 'string') {
    throw new Error('Sign-in failed. Please try again.')
  }

  return persistSession({
    provider: 'credentials',
    userId: typeof result.id === 'string' ? result.id : '',
    username: result.username,
    name: typeof result.name === 'string' ? result.name : '',
    email: typeof result.email === 'string' ? result.email : '',
    isAdmin: result.role === 'admin',
    signedInAt: Date.now(),
  })
}
