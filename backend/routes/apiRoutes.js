import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'
import authRoutes from './authRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import taskRoutes from './taskRoutes.js'
import userRoutes from './userRoutes.js'

const router = Router()

router.get('/health', getHealth)
router.use('/auth', authRoutes)
router.use('/notifications', notificationRoutes)
router.use('/users', userRoutes)
router.use('/tasks', taskRoutes)

export default router