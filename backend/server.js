import express from 'express'
import { connectDatabase } from './config/database.js'
import apiRoutes from './routes/apiRoutes.js'

const app = express()
const port = Number(process.env.PORT) || 3001

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