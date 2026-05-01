import { UserController } from '@/controllers/users-controllers'
import { Router } from 'express'


const usersRoutes = Router()
const userController = new UserController()

usersRoutes.post('/', userController.create)
usersRoutes.get('/', userController.index)

export { usersRoutes }