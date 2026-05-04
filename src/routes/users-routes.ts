import { UserController } from '@/controllers/users-controllers'
import { ensureAuthenticated } from '@/middleware/ensure-authenticated'
import { verifyUserAuthorization } from '@/middleware/verifyuserAuthorization'
import { Router } from 'express'
import { prisma } from '@/database/prisma'

const usersRoutes = Router()
const userController = new UserController()



// Criar usuário (Admin ou Cliente)
// Se não existe Admin ainda, permite criar o primeiro Admin sem token
usersRoutes.post('/', async (req, res, next) => {
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } })

    if (!adminExists && req.body.role === "ADMIN") {
        // cria o primeiro Admin sem exigir autenticação
        return userController.create(req, res)
    }

    // se já existe Admin, exige autenticação e autorização
    return ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, () => {
            userController.create(req, res)
        })
    })
})

// Cadastro de técnico (apenas ADMIN pode criar)
usersRoutes.post("/tecnicos",
    ensureAuthenticated,
    verifyUserAuthorization(["ADMIN"]),
    async (request, response) => {
        if (request.user?.role !== "ADMIN") {
            return response.status(403).json({ message: "Apenas ADMIN pode cadastrar técnicos" })
        }

        // força o role para TECNICO
        request.body.role = "TECNICO"
        return userController.create(request, response)
    }
)

usersRoutes.get('/', ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), userController.index)
usersRoutes.put('/:id', ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), userController.update)
usersRoutes.patch('/:id', ensureAuthenticated, verifyUserAuthorization(["ADMIN", "TECNICO"]), userController.update)

export { usersRoutes }
