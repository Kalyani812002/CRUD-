// Temporary verification: the Continue with Google button must render with the
// configured client ID, without console errors, on the login page.
import puppeteer from 'puppeteer-core'

const APP = 'http://localhost:5173'
const CLIENT_ID = '1014810658656-ai0r65d97jlolglejeijainkev1f985p.apps.googleusercontent.com'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  [${detail}]`}`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--disable-gpu'] })
const page = await browser.newPage()

const consoleMessages = []
const pageErrors = []
page.on('console', (m) => consoleMessages.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => pageErrors.push(e.message.split('\n')[0]))

await page.setViewport({ width: 1280, height: 800 })
await page.goto(APP, { waitUntil: 'networkidle2' })

// 1. Login form still renders (regression).
try {
  await page.waitForSelector('#login-username', { timeout: 10000 })
  check('login form renders', true)
} catch {
  check('login form renders', false, 'username field missing')
}

// 2. The Google button iframe appears (GIS rendered it with our client ID).
let iframeSrc = ''
try {
  await page.waitForSelector('.google-signin iframe', { timeout: 15000 })
  iframeSrc = await page.evaluate(() => document.querySelector('.google-signin iframe')?.src ?? '')
  check('Continue with Google button rendered (iframe present)', true)
} catch {
  check('Continue with Google button rendered (iframe present)', false, 'no iframe in .google-signin')
}

// 3. The iframe is actually Google's and carries OUR client ID.
check('iframe comes from accounts.google.com', iframeSrc.includes('accounts.google.com'), iframeSrc.slice(0, 140))
check('iframe carries the configured client ID', iframeSrc.includes(`client_id=${CLIENT_ID}`), iframeSrc.slice(0, 200))

// 4. "switched off" hint must be gone.
const hintState = await page.evaluate(() => ({
  unconfigured: Boolean(document.querySelector('.login-hint.google-login-note')),
  error: Boolean(document.querySelector('.api-error.google-login-note')),
}))
check('no "sign-in switched off" hint', !hintState.unconfigured)
check('no Google script error note', !hintState.error)

// 5. No page crashes or origin/config console errors.
check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '))
const blocking = consoleMessages.filter((m) =>
  m.startsWith('[error]')
  && /origin|client_id|client id|idpiframe|g8|not allowed|invalid/i.test(m))
check('no origin/client-id console errors from Google', blocking.length === 0, blocking.join(' | '))

// 6. The button is actually visible and has a real size.
const box = await page.evaluate(() => {
  const iframe = document.querySelector('.google-signin iframe')
  if (!iframe) return null
  const r = iframe.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height) }
})
check('button has a visible size', Boolean(box && box.w >= 150 && box.h >= 30), JSON.stringify(box))

// 7. Capture a screenshot for the record.
await page.screenshot({ path: 'google-login-check.png' })
console.log('Screenshot saved: google-login-check.png')

await browser.close()
const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.log('\nConsole output:')
  console.log(consoleMessages.slice(-15).join('\n') || '(none)')
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
