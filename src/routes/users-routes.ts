import { Router } from "express"
import { UserController } from "@/controllers/users-controllers"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization"
import { asyncHandler } from "@/utils/asyncHandler"
import { prisma } from "@/database/prisma"

const usersRoutes = Router()
const userController = new UserController()

// Listar todos os usuários (somente ADMIN)
usersRoutes.get("/", asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, async () => {
            await userController.index(req, res, next)
        })
    })
}))

// Criar usuário (Admin, Técnico ou Cliente)
usersRoutes.post("/", asyncHandler(async (req, res, next) => {
    const { role } = req.body;

    // Permite cadastro público de CLIENTE
    if (role === "CLIENTE") {
        return userController.create(req, res, next);
    }

    // Mantém regra para ADMIN e TECNICO
    const adminExists = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminExists && role === "ADMIN") {
        return userController.create(req, res, next);
    }

    ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, async () => {
            await userController.create(req, res, next);
        });
    });
}));


// Atualizar usuário (Admin pode atualizar qualquer um, Técnico/Cliente só o próprio)
usersRoutes.patch("/:id", asyncHandler(async (req, res) => {
    ensureAuthenticated(req, res, async () => {
        await userController.update(req, res)
    })
}))

// Listar todos os administradores
usersRoutes.get("/admins",
    ensureAuthenticated, // só usuários logados podem acessar
    userController.listAdmins
)

// Listar todos os técnicos
usersRoutes.get("/tecnicos",
    ensureAuthenticated,
    userController.listTecnicos
)
// Listar todos os clientes
usersRoutes.get("/clientes",
    ensureAuthenticated,
    userController.listClientes
)

// Excluir usuário (Admin pode excluir Admin, Técnico ou Cliente)
usersRoutes.delete("/:id", asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
        verifyUserAuthorization(["ADMIN"])(req, res, async () => {
            await userController.delete(req, res, next)
        })
    })
}))

export { usersRoutes }
