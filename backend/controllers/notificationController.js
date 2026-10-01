import { isEmailConfigured, sendTestEmail } from '../services/emailService.js'
import { getSmsStatus, isSmsConfigured, sendTestSms } from '../services/smsService.js'
import { getWhatsappStatus, isWhatsappConfigured, sendTestWhatsapp } from '../services/whatsappService.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/

// GET /api/notifications/status — reports whether outbound email/SMS/WhatsApp
// is set up, without exposing credentials. Email keys are unchanged for
// existing clients; `sms` and `whatsapp` are additive blocks.
export function getNotificationStatus(request, response) {
  response.json({
    configured: isEmailConfigured(),
    provider: 'smtp',
    from: (process.env.MAIL_FROM ?? '').trim() || 'Daymark <no-reply@daymark.local>',
    enabled: (process.env.EMAIL_ENABLED ?? '').trim().toLowerCase() !== 'false',
    sms: getSmsStatus(),
    whatsapp: getWhatsappStatus(),
  })
}

// POST /api/notifications/test — sends a test email so the SMTP integration
// can be verified end to end.
export async function sendTestNotification(request, response) {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(email)) {
    return response.status(400).json({ error: 'A valid email address is required.' })
  }

  try {
    await sendTestEmail(email)
    response.json({ message: `Test email sent to ${email}.` })
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message })
    response.status(502).json({ error: `The test email could not be sent: ${error.message}` })
  }
}

// POST /api/notifications/sms/test — sends a test SMS so the SMS API
// integration can be verified end to end.
export async function sendTestSmsNotification(request, response) {
  const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim() : ''
  if (!PHONE_PATTERN.test(phone)) {
    return response.status(400).json({ error: 'A valid phone number is required.' })
  }
  if (!isSmsConfigured()) {
    return response.status(400).json({ error: 'SMS notifications are not configured. Set SMS_API_URL (webhook) or Twilio variables in backend/.env.' })
  }

  try {
    await sendTestSms(phone)
    response.json({ message: `Test SMS sent to ${phone}.` })
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message })
    response.status(502).json({ error: `The test SMS could not be sent: ${error.message}` })
  }
}

// POST /api/notifications/whatsapp/test — sends a test WhatsApp message so the
// gateway integration can be verified end to end.
export async function sendTestWhatsappNotification(request, response) {
  const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim() : ''
  if (!PHONE_PATTERN.test(phone)) {
    return response.status(400).json({ error: 'A valid phone number is required.' })
  }
  if (!isWhatsappConfigured()) {
    return response.status(400).json({ error: 'WhatsApp notifications are not configured. Set WHATSAPP_API_URL (webhook) or WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_TOKEN (meta) in backend/.env.' })
  }

  try {
    await sendTestWhatsapp(phone)
    response.json({ message: `Test WhatsApp message sent to ${phone}.` })
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message })
    response.status(502).json({ error: `The test WhatsApp message could not be sent: ${error.message}` })
  }
}
