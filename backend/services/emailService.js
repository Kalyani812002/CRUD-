import nodemailer from 'nodemailer'
import User from '../models/User.js'

// Sends task assignment / update emails over SMTP.
// Configuration comes from the environment (backend/.env). When email is not
// configured, every send is a silent no-op so task CRUD is never blocked or
// failed by notification problems.

const DEFAULT_FROM = 'Daymark <no-reply@daymark.local>'

let transporter = null

function readConfig() {
  const host = (process.env.SMTP_HOST ?? '').trim()
  const enabled = (process.env.EMAIL_ENABLED ?? '').trim().toLowerCase() !== 'false'
  return {
    enabled,
    host,
    port: Number.parseInt(process.env.SMTP_PORT ?? '', 10) || 587,
    secure: (process.env.SMTP_SECURE ?? '').trim().toLowerCase() === 'true',
    user: (process.env.SMTP_USER ?? '').trim(),
    pass: process.env.SMTP_PASS ?? '',
    from: (process.env.MAIL_FROM ?? '').trim() || DEFAULT_FROM,
  }
}

export function isEmailConfigured() {
  const config = readConfig()
  return config.enabled && Boolean(config.host)
}

function getTransporter(config) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    })
  }
  return transporter
}

async function sendMail({ to, subject, text, html }) {
  const config = readConfig()
  if (!to) return { skipped: 'no recipient' }
  if (!config.enabled) return { skipped: 'email disabled' }
  if (!config.host) return { skipped: 'smtp not configured' }
  const info = await getTransporter(config).sendMail({ from: config.from, to, subject, text, html })
  console.log(`[email] sent "${subject}" to ${to}`)
  return { sent: true, messageId: info.messageId }
}

// Fire-and-forget wrapper: notification failures are logged, never thrown at
// the API caller, so task responses are unaffected.
function dispatch(label, work) {
  Promise.resolve()
    .then(work)
    .catch((error) => console.warn(`[email] ${label} notification failed: ${error.message}`))
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ))
}

function layout(heading, bodyHtml) {
  return [
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6fb;font-family:Segoe UI,Roboto,Arial,sans-serif;">',
    '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:28px;border:1px solid #e6eaf5;">',
    '<p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:1.6px;color:#6366f1;text-transform:uppercase;">Daymark</p>',
    `<h1 style="margin:0 0 14px;font-size:20px;color:#0f172a;">${escapeHtml(heading)}</h1>`,
    bodyHtml,
    '<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #eef1f7;font-size:11px;color:#94a3b8;">Sent by Daymark Task Management</p>',
    '</div></body></html>',
  ].join('')
}

function taskLines(task) {
  const lines = [
    `<p style="margin:0 0 6px;font-size:14px;color:#334155;"><strong>${escapeHtml(task.title)}</strong></p>`,
  ]
  if (task.status) lines.push(`<p style="margin:0 0 6px;font-size:13px;color:#64748b;">Status: ${escapeHtml(task.status)}</p>`)
  if (task.description) lines.push(`<p style="margin:6px 0 0;font-size:13px;color:#64748b;">${escapeHtml(task.description)}</p>`)
  return lines.join('')
}

async function findRecipient(userId) {
  if (!userId) return null
  const user = await User.findById(userId).select('email name username').lean()
  if (!user?.email) return null
  return user
}

// "You have been assigned a task" email. Fire-and-forget.
export function notifyTaskAssigned(task, assigneeId) {
  dispatch('assignment', async () => {
    const recipient = await findRecipient(assigneeId)
    if (!recipient) return { skipped: 'assignee has no email' }
    const greeting = recipient.name || recipient.username || 'there'
    return sendMail({
      to: recipient.email,
      subject: `You've been assigned: ${task.title}`,
      text: [
        `Hi ${greeting},`,
        '',
        `You've been assigned a new task in Daymark:`,
        '',
        `  ${task.title}`,
        `  Status: ${task.status}`,
        task.description ? `  ${task.description}` : null,
        '',
        'Open Daymark to view the task and update its status.',
      ].filter((line) => line !== null).join('\n'),
      html: layout('You\'ve been assigned a task', [
        `<p style="margin:0 0 14px;font-size:14px;color:#334155;">Hi ${escapeHtml(greeting)},</p>`,
        taskLines(task),
        '<p style="margin:16px 0 0;font-size:13px;color:#64748b;">Open Daymark to view the task and update its status.</p>',
      ].join('')),
    })
  })
}

// "Task updated" email listing what changed. Fire-and-forget.
export function notifyTaskUpdated(task, assigneeId, changes) {
  dispatch('update', async () => {
    const recipient = await findRecipient(assigneeId)
    if (!recipient) return { skipped: 'assignee has no email' }
    const greeting = recipient.name || recipient.username || 'there'
    const changeLines = changes.map((change) => `  ${change.field}: ${change.from} -> ${change.to}`)
    const changeHtml = changes.map((change) => (
      `<li style="margin:0 0 4px;font-size:13px;color:#64748b;"><strong>${escapeHtml(change.field)}</strong>: ${escapeHtml(change.from)} &rarr; ${escapeHtml(change.to)}</li>`
    )).join('')
    return sendMail({
      to: recipient.email,
      subject: `Task updated: ${task.title}`,
      text: [
        `Hi ${greeting},`,
        '',
        `"${task.title}" was updated:`,
        '',
        ...changeLines,
        '',
        'Open Daymark to see the latest version.',
      ].join('\n'),
      html: layout('A task was updated', [
        `<p style="margin:0 0 14px;font-size:14px;color:#334155;">Hi ${escapeHtml(greeting)},</p>`,
        taskLines(task),
        `<ul style="margin:14px 0 0;padding-left:18px;">${changeHtml}</ul>`,
        '<p style="margin:16px 0 0;font-size:13px;color:#64748b;">Open Daymark to see the latest version.</p>',
      ].join('')),
    })
  })
}

// Used by POST /api/notifications/test — awaited so the caller can report
// success or failure. Throws with `status` set for expected config errors.
export async function sendTestEmail(to) {
  if (!isEmailConfigured()) {
    const error = new Error('Email notifications are not configured. Set SMTP_HOST (and related variables) in backend/.env.')
    error.status = 400
    throw error
  }
  return sendMail({
    to,
    subject: 'Daymark email test',
    text: 'This is a test email from Daymark Task Management. If you received it, SMTP is configured correctly.',
    html: layout('SMTP is configured correctly', '<p style="margin:0;font-size:14px;color:#334155;">This is a test email from Daymark Task Management. If you received it, notifications will work for task assignments and updates.</p>'),
  })
}
