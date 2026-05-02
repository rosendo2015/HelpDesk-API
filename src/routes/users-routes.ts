import { UserController } from '@/controllers/users-controllers'
import { ensureAuthenticated } from '@/middleware/ensure-authenticated'
import { Router } from 'express'


const usersRoutes = Router()
const userController = new UserController()

usersRoutes.post('/', userController.create)
usersRoutes.get('/', ensureAuthenticated, userController.index)
// Atualizar usuário (um ou vários campos)
usersRoutes.put('/:id', ensureAuthenticated, userController.update)
// Se preferir atualização parcial, pode usar PATCH:
usersRoutes.patch('/:id', ensureAuthenticated, userController.update)

export { usersRoutes }