import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'
import taskRoutes from './taskRoutes.js'

const router = Router()

router.get('/health', getHealth)
router.use('/tasks', taskRoutes)

export default router