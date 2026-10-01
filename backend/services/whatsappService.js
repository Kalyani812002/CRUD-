import User from '../models/User.js'
import { toE164 } from './smsService.js'

// Configurable WhatsApp notification service.
// Providers:
//   webhook (default) — POSTs JSON { to, message, from } to WHATSAPP_API_URL.
//                       Optional auth: WHATSAPP_API_KEY (+ WHATSAPP_API_HEADER,
//                       WHATSAPP_API_PREFIX). Works with any gateway exposing a
//                       JSON POST API (Twilio WhatsApp, WATI, Interakt, etc.).
//   meta              — WhatsApp Business Cloud API. Posts
//                       { messaging_product: 'whatsapp', to, type: 'text' } to
//                       WHATSAPP_GRAPH_URL/{version}/{id}/messages with a
//                       Bearer WHATSAPP_TOKEN (requires WHATSAPP_PHONE_NUMBER_ID).
// Fire-and-forget: failures are logged, never thrown at callers; with no
// provider configured every send is a silent no-op.
// Recipients are users with a phone number on their profile.

function readConfig() {
  const enabled = (process.env.WHATSAPP_ENABLED ?? '').trim().toLowerCase() !== 'false'
  const provider = (process.env.WHATSAPP_PROVIDER ?? '').trim().toLowerCase() || 'webhook'
  return {
    enabled,
    provider: provider === 'meta' ? 'meta' : 'webhook',
    apiUrl: (process.env.WHATSAPP_API_URL ?? '').trim(),
    apiKey: (process.env.WHATSAPP_API_KEY ?? '').trim(),
    apiHeader: (process.env.WHATSAPP_API_HEADER ?? '').trim() || 'Authorization',
    apiPrefix: process.env.WHATSAPP_API_PREFIX === undefined ? 'Bearer ' : process.env.WHATSAPP_API_PREFIX,
    from: (process.env.WHATSAPP_FROM ?? '').trim(),
    countryCode: (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE ?? process.env.SMS_DEFAULT_COUNTRY_CODE ?? '').trim(),
    graphUrl: (process.env.WHATSAPP_GRAPH_URL ?? '').trim() || 'https://graph.facebook.com',
    apiVersion: (process.env.WHATSAPP_API_VERSION ?? '').trim() || 'v21.0',
    phoneNumberId: (process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim(),
    token: (process.env.WHATSAPP_TOKEN ?? '').trim(),
  }
}

export function isWhatsappConfigured() {
  const config = readConfig()
  if (!config.enabled) return false
  if (config.provider === 'meta') return Boolean(config.phoneNumberId && config.token)
  return Boolean(config.apiUrl)
}

async function postJson(url, body, headers) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`WhatsApp API responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return response
}

async function sendViaProvider(config, to, message) {
  if (config.provider === 'meta') {
    return postJson(
      `${config.graphUrl}/${config.apiVersion}/${config.phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: message } },
      { Authorization: `Bearer ${config.token}` },
    )
  }
  const headers = {}
  if (config.apiKey) headers[config.apiHeader] = `${config.apiPrefix}${config.apiKey}`
  return postJson(config.apiUrl, { to, message, ...(config.from ? { from: config.from } : {}) }, headers)
}

async function deliver(toRaw, message) {
  const config = readConfig()
  if (!config.enabled) return { skipped: 'whatsapp disabled' }
  if (!isWhatsappConfigured()) return { skipped: 'whatsapp not configured' }
  const to = toE164(toRaw, config.countryCode)
  if (!to) return { skipped: 'invalid recipient number' }
  await sendViaProvider(config, to, message)
  console.log(`[whatsapp] sent to ${to}`)
  return { sent: true, to }
}

// Fire-and-forget: failures are logged, never thrown at API callers.
function dispatch(label, work) {
  Promise.resolve()
    .then(work)
    .catch((error) => console.warn(`[whatsapp] ${label} notification failed: ${error.message}`))
}

async function findRecipient(userId) {
  if (!userId) return null
  const user = await User.findById(userId).select('phone name username').lean()
  if (!user?.phone) return null
  return user
}

// Keep messages compact so they stay within a single WhatsApp text message.
function clip(message) {
  return message.length > 4096 ? `${message.slice(0, 4093)}...` : message
}

// "Task assigned" WhatsApp message. Fire-and-forget.
export function notifyWhatsappTaskAssigned(task, assigneeId) {
  dispatch('assignment', async () => {
    const recipient = await findRecipient(assigneeId)
    if (!recipient) return { skipped: 'assignee has no phone number' }
    const message = clip(`Daymark: You've been assigned "${task.title}" (status: ${task.status}). Open Daymark to view it.`)
    return deliver(recipient.phone, message)
  })
}

// "Task updated" WhatsApp message listing what changed. Fire-and-forget.
export function notifyWhatsappTaskUpdated(task, assigneeId, changes) {
  dispatch('update', async () => {
    const recipient = await findRecipient(assigneeId)
    if (!recipient) return { skipped: 'assignee has no phone number' }
    const summary = changes.map((change) => `${change.field}: ${change.from} -> ${change.to}`).join('; ')
    const message = clip(`Daymark: "${task.title}" was updated - ${summary}.`)
    return deliver(recipient.phone, message)
  })
}

// Used by POST /api/notifications/whatsapp/test — awaited so the caller can
// report success or failure. Throws with `status` set for expected config errors.
export async function sendTestWhatsapp(phone) {
  if (!isWhatsappConfigured()) {
    const error = new Error('WhatsApp notifications are not configured. Set WHATSAPP_API_URL (webhook) or WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_TOKEN (meta) in backend/.env.')
    error.status = 400
    throw error
  }
  const to = toE164(phone, readConfig().countryCode)
  if (!to) {
    const error = new Error('Enter a valid phone number (7-15 digits after normalization).')
    error.status = 400
    throw error
  }
  return deliver(phone, 'Daymark: test message. If you received it, WhatsApp notifications are configured correctly.')
}

// Reported by GET /api/notifications/status — never exposes credentials.
export function getWhatsappStatus() {
  const config = readConfig()
  return {
    configured: isWhatsappConfigured(),
    provider: config.provider,
    enabled: config.enabled,
    from: config.provider === 'meta' ? config.phoneNumberId : config.from,
  }
}
