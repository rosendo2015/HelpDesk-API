import { Router } from "express"
import { ChamadosControllers } from "@/controllers/chamados-controllers"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyuserAuthorization"

const chamadosRoutes = Router()
const chamadosControllers = new ChamadosControllers()

// Criar chamado (cliente)
chamadosRoutes.post("/",
    ensureAuthenticated,
    verifyUserAuthorization(["CLIENTE"]),
    chamadosControllers.create
)

// Listar chamados (filtra por role)
chamadosRoutes.get("/",
    ensureAuthenticated,
    chamadosControllers.index
)

// Listar chamados de um tecnico especifico 
chamadosRoutes.get("/tecnico/:id",
    ensureAuthenticated,
    chamadosControllers.listByTecnico
)

// Update chamados - passe o id do chamado
chamadosRoutes.patch("/:id",
    ensureAuthenticated,
    chamadosControllers.update
)

export { chamadosRoutes }
