import { Router } from "express"
import { ChamadosControllers } from "@/controllers/chamados-controllers"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"

const chamadosRoutes = Router()
const chamadosControllers = new ChamadosControllers()

// Criar chamado (cliente)
chamadosRoutes.post("/", ensureAuthenticated, chamadosControllers.create)

// Listar chamados (filtra por role)
chamadosRoutes.get("/", ensureAuthenticated, chamadosControllers.index)

export { chamadosRoutes }
