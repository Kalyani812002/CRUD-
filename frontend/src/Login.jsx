import { useEffect, useRef, useState } from 'react'
import { Check, Eye, EyeOff, LoaderCircle, LogIn } from 'lucide-react'
import { LOGIN_PASSWORD, LOGIN_USERNAME, signIn, signInWithCredentials, signInWithGoogle } from './auth.js'

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

function loadGoogleIdentityScript() {
  const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_URL}"]`)
  if (existingScript) {
    if (globalThis.google?.accounts?.id) return Promise.resolve()
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Google sign-in could not be loaded.')),
        { once: true },
      )
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google sign-in could not be loaded.'))
    document.head.appendChild(script)
  })
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [googleState, setGoogleState] = useState(GOOGLE_CLIENT_ID ? 'loading' : 'unconfigured')
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)
  const googleButtonRef = useRef(null)
  const googleCallbackRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()

    const nextUsernameError = username.trim() ? '' : 'Username is required.'
    const nextPasswordError = password ? '' : 'Password is required.'
    setUsernameError(nextUsernameError)
    setPasswordError(nextPasswordError)
    setFormError('')
    if (nextUsernameError || nextPasswordError) return

    setIsSigningIn(true)
    try {
      let session
      try {
        session = await signIn(username, password)
      } catch (localError) {
        // The built-in "admin" account is checked locally — never fall through
        // to the API for it. Any other username tries the API accounts.
        if (username.trim().toLowerCase() === LOGIN_USERNAME) throw localError
        session = await signInWithCredentials(username, password)
      }
      onLogin(session)
    } catch (error) {
      setFormError(error.message)
      setPassword('')
      setIsSigningIn(false)
    }
  }

  async function handleGoogleCredential(response) {
    if (isGoogleSigningIn) return
    setFormError('')
    setIsGoogleSigningIn(true)
    try {
      if (!response?.credential) {
        throw new Error('Google sign-in did not complete. Please try again.')
      }
      const session = await signInWithGoogle(response.credential, GOOGLE_CLIENT_ID)
      onLogin(session)
    } catch (error) {
      setFormError(error.message)
      setIsGoogleSigningIn(false)
    }
  }

  useEffect(() => {
    googleCallbackRef.current = handleGoogleCredential
  })

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined
    let isCancelled = false

    loadGoogleIdentityScript()
      .then(() => {
        if (isCancelled) return
        const google = globalThis.google
        const container = googleButtonRef.current
        if (!google?.accounts?.id || !container) {
          setGoogleState('error')
          return
        }
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (credentialResponse) => googleCallbackRef.current?.(credentialResponse),
        })
        if (container.childElementCount === 0) {
          const width = Math.round(container.getBoundingClientRect().width)
          google.accounts.id.renderButton(container, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            ...(width >= 200 ? { width } : {}),
          })
        }
        setGoogleState('ready')
      })
      .catch(() => {
        if (!isCancelled) setGoogleState('error')
      })

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <div className="login-shell">
      <aside className="login-brand-panel">
        <div className="brand">
          <span className="brand-mark"><Check size={18} strokeWidth={3} /></span>
          <span>Daymark<span className="brand-period">.</span></span>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow">YOUR DAY, IN FOCUS</p>
          <h1>Pick up where you left off.</h1>
          <p>Sign in to open your dashboard, keep tasks moving, and see what deserves your attention today.</p>
        </div>
        <p className="login-brand-foot">
          <span>One thing at a time.</span>
          <span className="footer-mark"><Check size={12} strokeWidth={3} /></span>
        </p>
      </aside>

      <main className="login-main">
        <section className="login-card">
          <header className="login-card-header">
            <p className="eyebrow">WELCOME BACK</p>
            <h2>Log in to your workspace</h2>
            <p className="login-subtitle">Enter your details to reach the dashboard.</p>
          </header>

          <form className="task-form" onSubmit={handleSubmit} noValidate>
            {formError && <p className="api-error task-form-error" role="alert">{formError}</p>}

            <label className="form-field" htmlFor="login-username">
              <span>Username</span>
              <input
                aria-describedby={usernameError ? 'login-username-error' : undefined}
                aria-invalid={Boolean(usernameError)}
                aria-required="true"
                autoComplete="username"
                autoFocus
                id="login-username"
                maxLength={64}
                onChange={(event) => {
                  setUsername(event.target.value)
                  if (event.target.value.trim()) setUsernameError('')
                }}
                placeholder="Enter your username"
                value={username}
              />
              {usernameError && <span className="field-error" id="login-username-error">{usernameError}</span>}
            </label>

            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <span className="password-wrap">
                <input
                  aria-describedby={passwordError ? 'login-password-error' : undefined}
                  aria-invalid={Boolean(passwordError)}
                  aria-required="true"
                  autoComplete="current-password"
                  id="login-password"
                  maxLength={128}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (event.target.value) setPasswordError('')
                  }}
                  placeholder="Enter your password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="password-toggle"
                  onClick={() => setShowPassword((isVisible) => !isVisible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
              {passwordError && <span className="field-error" id="login-password-error">{passwordError}</span>}
            </div>

            <div className="modal-actions login-actions">
              <button className="primary-button login-submit" disabled={isSigningIn} type="submit">
                {isSigningIn ? <LoaderCircle className="spin" size={17} /> : <LogIn size={17} />}
                {isSigningIn ? 'Signing in...' : 'Log in'}
              </button>
            </div>
          </form>

          <p className="login-hint">
            Demo account — <strong>{LOGIN_USERNAME}</strong> / <strong>{LOGIN_PASSWORD}</strong>
          </p>

          <div className="login-divider">
            <span>or continue with</span>
          </div>

          {googleState === 'unconfigured' && (
            <p className="login-hint google-login-note">
              Google sign-in is switched off — set <strong>VITE_GOOGLE_CLIENT_ID</strong> in <code>frontend/.env</code> to enable it.
            </p>
          )}

          {googleState === 'error' && (
            <p className="api-error google-login-note" role="alert">
              Google sign-in could not be loaded. Please refresh the page and try again.
            </p>
          )}

          {(googleState === 'loading' || googleState === 'ready') && (
            <div className="google-signin" ref={googleButtonRef} />
          )}
        </section>
      </main>
    </div>
  )
}

export default Login
