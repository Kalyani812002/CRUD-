import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(moduleDirectory, '../.env')

dotenv.config({ path: envPath })

export async function connectDatabase() {
  const { MONGODB_URI } = process.env
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Set it in backend/.env.')
  }

  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')
}