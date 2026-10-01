import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// Dependency-free password hashing (Node's built-in scrypt).
// Stored format: scrypt$<salt hex>$<derived key hex>
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }

function deriveKey(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await deriveKey(password, salt)
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false
  const [scheme, salt, expectedHex] = storedHash.split('$')
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false

  const expected = Buffer.from(expectedHex, 'hex')
  const derivedKey = await deriveKey(password, salt)
  if (expected.length !== derivedKey.length) return false
  return timingSafeEqual(derivedKey, expected)
}
