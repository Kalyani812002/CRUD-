import User from '../models/User.js'
import { hashPassword, verifyPassword } from '../utils/passwords.js'

// Verified against when the account does not exist, so unknown usernames
// take about as long as a wrong password.
const DUMMY_PASSWORD_HASH = await hashPassword('dummy-password-for-timing')

export async function login(request, response, next) {
  try {
    const body = request.body ?? {}
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || !password) {
      return response.status(400).json({ error: 'Username and password are required.' })
    }

    const user = await User.findOne({ username }).select('+passwordHash')
    const passwordIsValid = await verifyPassword(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH)
    if (!user || !passwordIsValid) {
      return response.status(401).json({ error: 'Incorrect username or password. Please try again.' })
    }

    response.json({
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    next(error)
  }
}
