import User from '../models/User.js'

// Configurable SMS notification service.
// Providers:
//   webhook  (default) — POSTs JSON { to, message, from } to SMS_API_URL.
//                        Auth header is optional: SMS_API_KEY (+ SMS_API_HEADER,
//                        default "Authorization" with "Bearer " prefix).
//   twilio              — Twilio REST API using TWILIO_ACCOUNT_SID,
//                        TWILIO_AUTH_TOKEN and TWILIO_FROM.
// Sending is fire-and-forget: failures are logged, never thrown at callers,
// and with SMS_ENABLED=false (or no provider config) every send is a no-op.

const DEFAULT_COUNTRY_CODE = process.env.SMS_DEFAULT_COUNTRY_CODE ?? ''

function readConfig() {
  const enabled = (process.env.SMS_ENABLED ?? '').trim().toLowerCase() !== 'false'
  const provider = (process.env.SMS_PROVIDER ?? '').trim().toLowerCase() || 'webhook'
  return {
    enabled,
    provider: provider === 'twilio' ? 'twilio' : 'webhook',
    apiUrl: (process.env.SMS_API_URL ?? '').trim(),
    apiKey: (process.env.SMS_API_KEY ?? '').trim(),
    apiHeader: (process.env.SMS_API_HEADER ?? '').trim() || 'Authorization',
    apiPrefix: process.env.SMS_API_PREFIX === undefined ? 'Bearer ' : process.env.SMS_API_PREFIX,
    from: (process.env.SMS_FROM ?? '').trim(),
    countryCode: (process.env.SMS_DEFAULT_COUNTRY_CODE ?? '').trim() || DEFAULT_COUNTRY_CODE,
    twilioSid: (process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
    twilioToken: (process.env.TWILIO_AUTH_TOKEN ?? '').trim(),
    twilioFrom: (process.env.TWILIO_FROM ?? '').trim(),
  }
}

export function isSmsConfigured() {
  const config = readConfig()
  if (!config.enabled) return false
  if (config.provider === 'twilio') return Boolean(config.twilioSid && config.twilioToken && config.twilioFrom)
  return Boolean(config.apiUrl)
}

// Normalizes common formats to E.164 (+<digits>). Returns null when the
// number cannot be made valid, so bad data never reaches the SMS provider.
export function toE164(raw, countryCode = readConfig().countryCode) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  let value = raw.trim().replace(/[\s\-().]/g, '')
  if (value.startsWith('00')) value = `+${value.slice(2)}`
  if (!value.startsWith('+') && countryCode) value = `${countryCode}${value.replace(/^0+/, '')}`
  return /^\+\d{7,15}$/.test(value) ? value : null
}

async function postJson(url, body, headers) {
  const isForm = body instanceof URLSearchParams
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(isForm ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: isForm ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`SMS API responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return response
}

async function sendViaProvider(config, to, message) {
  if (config.provider === 'twilio') {
    const auth = Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64')
    return postJson(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`,
      new URLSearchParams({ To: to, From: config.twilioFrom, Body: message }),
      { Authorization: `Basic ${auth}` },
    )
  }
  const headers = {}
  if (config.apiKey) headers[config.apiHeader] = `${config.apiPrefix}${config.apiKey}`
  return postJson(config.apiUrl, { to, message, ...(config.from ? { from: config.from } : {}) }, headers)
}

async function deliver(toRaw, message) {
  const config = readConfig()
  if (!config.enabled) return { skipped: 'sms disabled' }
  if (!isSmsConfigured()) return { skipped: 'sms not configured' }
  const to = toE164(toRaw, config.countryCode)
  if (!to) return { skipped: 'invalid recipient number' }
  await sendViaProvider(config, to, message)
  console.log(`[sms] sent to ${to}`)
  return { sent: true, to }
}

// Fire-and-forget: SMS failures are logged, never thrown at API callers.
function dispatch(label, work) {
  Promise.resolve()
    .then(work)
    .catch((error) => console.warn(`[sms] ${label} notification failed: ${error.message}`))
}

async function findRecipient(userId) {
  if (!userId) return null
  const user = await User.findById(userId).select('phone name username').lean()
  if (!user?.phone) return null
  return user
}

// Keep messages compact — most gateways price per segment (160 GSM-7 chars).
function clip(message) {
  return message.length > 320 ? `${message.slice(0, 317)}...` : message
}

// "Task assigned" SMS. Fire-and-forget.
export function notifySmsTaskAssigned(task, assigneeId) {
  dispatch('assignment', async () => {
    const recipient = await findRecipient(assigneeId)
    if (!recipient) return { skipped: 'assignee has no phone number' }
    const message = clip(`Daymark: You've been assigned "${task.title}" (status: ${task.status}). Open Daymark to view it.`)
    return deliver(recipient.phone, message)
  })
}

// "Task updated" SMS listing what changed. Fire-and-forget.
export function notifySmsTaskUpdated(task, assigneeId, changes) {
  dispatch('update', async () => {
    const recipient = await findRecipient(assigneeId)
    if (!recipient) return { skipped: 'assignee has no phone number' }
    const summary = changes.map((change) => `${change.field}: ${change.from} -> ${change.to}`).join('; ')
    const message = clip(`Daymark: "${task.title}" was updated - ${summary}.`)
    return deliver(recipient.phone, message)
  })
}

// Used by POST /api/notifications/sms/test — awaited so the caller can report
// success or failure. Throws with `status` set for expected config errors.
export async function sendTestSms(phone) {
  if (!isSmsConfigured()) {
    const error = new Error('SMS notifications are not configured. Set SMS_API_URL (webhook) or Twilio variables in backend/.env.')
    error.status = 400
    throw error
  }
  const to = toE164(phone)
  if (!to) {
    const error = new Error('Enter a valid phone number (7-15 digits after normalization).')
    error.status = 400
    throw error
  }
  return deliver(phone, 'Daymark: test SMS. If you received it, SMS notifications are configured correctly.')
}

// Reported by GET /api/notifications/status — never exposes credentials.
export function getSmsStatus() {
  const config = readConfig()
  return {
    configured: isSmsConfigured(),
    provider: config.provider,
    enabled: config.enabled,
    from: config.provider === 'twilio' ? config.twilioFrom : config.from,
  }
}
