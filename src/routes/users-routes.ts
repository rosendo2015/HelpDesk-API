import { UserController } from '@/controllers/users-controllers'
import { Router } from 'express'


const usersRoutes = Router()
const userController = new UserController()

usersRoutes.post('/', userController.create)
usersRoutes.get('/', userController.index)
// Atualizar usuário (um ou vários campos)
usersRoutes.put('/:id', userController.update)
// Se preferir atualização parcial, pode usar PATCH:
usersRoutes.patch('/:id', userController.update)

export { usersRoutes }