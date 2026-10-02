import express from 'express'
import { connectDatabase } from './config/database.js'
import apiRoutes from './routes/apiRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 3001

// Cross-origin API access: the frontend runs at http://localhost:5173 in
// development and is deployed to Vercel (https://<project>.vercel.app) while
// the API may be hosted elsewhere (e.g. https://crud-1-xp3y.onrender.com).
// Allowed origins: http://localhost:5173, any *.vercel.app origin, plus any
// extra origins listed in CORS_ALLOWED_ORIGINS (comma-separated). OPTIONS
// preflights are answered with 204 and the Authorization/Content-Type request
// headers are accepted. No credentials/cookies are used by the API.
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173']
const EXTRA_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function isAllowedOrigin(origin) {
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin) || EXTRA_ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const { protocol, hostname } = new URL(origin)
    return protocol === 'https:' && (hostname === 'vercel.app' || hostname.endsWith('.vercel.app'))
  } catch {
    return false
  }
}

app.use((request, response, next) => {
  const origin = request.headers.origin
  if (origin && isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Max-Age', '86400')
  }
  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }
  next()
})

app.use(express.json({ limit: '32kb' }))
app.get('/', (request, response) => {
  response.json({ message: 'Task Management API is running' })
})
app.use('/api', apiRoutes)
app.use('/api', (request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  const status = error.status ?? 500
  response.status(status).json({ error: status === 500 ? 'Internal server error.' : error.message })
})

await connectDatabase()
app.listen(port, () => {
  console.log(`Task API listening on http://localhost:${port}`)
})