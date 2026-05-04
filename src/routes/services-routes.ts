import { Router } from "express"
import { ServicesController } from "@/controllers/services-controller"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyuserAuthorization"

const servicesRoutes = Router()
const servicesController = new ServicesController()

// Admin cria e atualiza serviços
servicesRoutes.post("/", ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), servicesController.create)
servicesRoutes.patch("/:id", ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), servicesController.update)

// Qualquer usuário pode listar serviços ativos
servicesRoutes.get("/", ensureAuthenticated, servicesController.index)

export { servicesRoutes }
