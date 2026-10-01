import { Router } from 'express'
import { addUser, editUser, listUsers, removeUser } from '../controllers/userController.js'

const router = Router()

router.get('/', listUsers)
router.post('/', addUser)
router.put('/:id', editUser)
router.delete('/:id', removeUser)

export default router
