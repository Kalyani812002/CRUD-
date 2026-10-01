import User from '../models/User.js'
import Task from '../models/Task.js'
import { hashPassword } from '../utils/passwords.js'

const RESERVED_USERNAMES = new Set(['admin'])
const OBJECT_ID_PATTERN = /^[\da-f]{24}$/i

function sanitizeUser(user) {
  const plain = user.toObject ? user.toObject() : { ...user }
  delete plain.passwordHash
  return plain
}

function isDuplicateKeyError(error) {
  return error?.code === 11000
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function passwordError(password) {
  if (typeof password !== 'string' || password.length < 6) return 'Password must be at least 6 characters.'
  if (password.length > 128) return 'Password cannot exceed 128 characters.'
  return null
}

const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/

// Optional field: empty clears it, anything else must look like a phone number.
function normalizePhone(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function phoneError(phone) {
  if (!phone) return null
  if (!PHONE_PATTERN.test(phone)) return 'Enter a valid phone number (7-20 digits, optional + country code).'
  if (!/\d{7,15}/.test(phone.replace(/\D/g, ''))) return 'Enter a valid phone number (7-20 digits, optional + country code).'
  return null
}

function duplicateError() {
  return { error: 'A user with that username or email already exists.' }
}

export async function listUsers(request, response, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean()
    response.json(users.map(sanitizeUser))
  } catch (error) {
    next(error)
  }
}

export async function addUser(request, response, next) {
  try {
    const body = request.body ?? {}

    const invalidPassword = passwordError(body.password)
    if (invalidPassword) return response.status(400).json({ error: invalidPassword })

    const username = normalizeUsername(body.username)
    const email = normalizeEmail(body.email)
    const phone = normalizePhone(body.phone)
    const invalidPhone = phoneError(phone)
    if (invalidPhone) return response.status(400).json({ error: invalidPhone })
    if (RESERVED_USERNAMES.has(username)) {
      return response.status(400).json({ error: 'The username "admin" is reserved.' })
    }

    const existing = await User.findOne({
      $or: [{ username }, ...(email ? [{ email }] : [])],
    }).lean()
    if (existing) return response.status(409).json(duplicateError())

    const passwordHash = await hashPassword(body.password)
    const user = await User.create({
      username: body.username,
      name: body.name,
      email: body.email,
      phone: phone || null,
      role: body.role,
      passwordHash,
    })
    response.status(201).json(sanitizeUser(user))
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    }
    if (isDuplicateKeyError(error)) return response.status(409).json(duplicateError())
    next(error)
  }
}

export async function editUser(request, response, next) {
  const { id } = request.params
  const updates = request.body

  if (!OBJECT_ID_PATTERN.test(id)) {
    return response.status(400).json({ error: 'Invalid user ID.' })
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return response.status(400).json({ error: 'A user update object is required.' })
  }

  try {
    const user = await User.findById(id).select('+passwordHash')
    if (!user) return response.status(404).json({ error: 'User not found.' })

    if (typeof updates.password === 'string' && updates.password) {
      const invalidPassword = passwordError(updates.password)
      if (invalidPassword) return response.status(400).json({ error: invalidPassword })
    }

    const usernameChanged = Object.hasOwn(updates, 'username')
      && normalizeUsername(updates.username) !== user.username
    const emailChanged = Object.hasOwn(updates, 'email')
      && normalizeEmail(updates.email) !== user.email

    if (usernameChanged && RESERVED_USERNAMES.has(normalizeUsername(updates.username))) {
      return response.status(400).json({ error: 'The username "admin" is reserved.' })
    }

    if (usernameChanged || emailChanged) {
      const nextUsername = normalizeUsername(updates.username)
      const nextEmail = normalizeEmail(updates.email)
      const clash = await User.findOne({
        _id: { $ne: user._id },
        $or: [
          ...(usernameChanged ? [{ username: nextUsername }] : []),
          ...(emailChanged && nextEmail ? [{ email: nextEmail }] : []),
        ],
      }).lean()
      if (clash) return response.status(409).json(duplicateError())
    }

    for (const field of ['username', 'name', 'email', 'role']) {
      if (Object.hasOwn(updates, field)) user[field] = updates[field]
    }
    if (Object.hasOwn(updates, 'phone')) {
      const phone = normalizePhone(updates.phone)
      const invalidPhone = phoneError(phone)
      if (invalidPhone) return response.status(400).json({ error: invalidPhone })
      user.phone = phone || null
    }
    if (typeof updates.password === 'string' && updates.password) {
      user.passwordHash = await hashPassword(updates.password)
    }

    await user.save()
    response.json(sanitizeUser(user))
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return response.status(400).json({ error: error.message })
    }
    if (isDuplicateKeyError(error)) return response.status(409).json(duplicateError())
    next(error)
  }
}

export async function removeUser(request, response, next) {
  const { id } = request.params
  if (!OBJECT_ID_PATTERN.test(id)) {
    return response.status(400).json({ error: 'Invalid user ID.' })
  }

  try {
    const user = await User.findByIdAndDelete(id)
    if (!user) return response.status(404).json({ error: 'User not found.' })
    // Clear any task assignments held by the removed user.
    await Task.updateMany({ assignee: user._id }, { $set: { assignee: null } })
    response.json({ message: 'User deleted successfully.' })
  } catch (error) {
    if (error.name === 'CastError') {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
}
