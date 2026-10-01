import { Router } from 'express'
import { getNotificationStatus, sendTestNotification, sendTestSmsNotification, sendTestWhatsappNotification } from '../controllers/notificationController.js'

const router = Router()

router.get('/status', getNotificationStatus)
router.post('/test', sendTestNotification)
router.post('/sms/test', sendTestSmsNotification)
router.post('/whatsapp/test', sendTestWhatsappNotification)

export default router
