import { Router } from "express"
import { UserController } from "@/controllers/users-controllers"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyuserAuthorization"
import { asyncHandler } from "@/utils/asyncHandler"
import { prisma } from "@/database/prisma"

const usersRoutes = Router()
const userController = new UserController()

// Listar todos os usuários (somente ADMIN)
usersRoutes.get("/", asyncHandler(async (req, res) => {
    ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, async () => {
            await userController.index(req, res)
        })
    })
}))

// Criar usuário (Admin, Técnico ou Cliente)
usersRoutes.post("/", asyncHandler(async (req, res, next) => {
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } })

    if (!adminExists && req.body.role === "ADMIN") {
        // cria o primeiro Admin sem exigir autenticação
        return userController.create(req, res, next)
    }

    // se já existe Admin, exige autenticação e autorização
    ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, async () => {
            await userController.create(req, res, next)
        })
    })
}))

// Atualizar usuário (Admin pode atualizar qualquer um, Técnico/Cliente só o próprio)
usersRoutes.put("/:id", asyncHandler(async (req, res) => {
    ensureAuthenticated(req, res, async () => {
        await userController.update(req, res)
    })
}))

// Excluir usuário (Admin pode excluir Admin, Técnico ou Cliente)
usersRoutes.delete("/:id", asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, async () => {
            await userController.delete(req, res, next)
        })
    })
}))

export { usersRoutes }
