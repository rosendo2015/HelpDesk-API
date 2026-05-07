import { Router } from "express";
import { usersRoutes } from "./users-routes";
import { sessionsRoutes } from "./sessions-routes";
import { disponibilidadesRoutes } from "./disponibilidades-routes";
import { servicesRoutes } from "./services-routes";
import { chamadosRoutes } from "./chamados-routes";
import { AppError } from "@/utils/AppError";

const routes = Router()

routes.get("/test-error", () => {
    throw new AppError("Erro de teste", 400)
})

routes.use("/users", usersRoutes)
routes.use("/sessions", sessionsRoutes)
routes.use("/disponibilidades", disponibilidadesRoutes)
routes.use("/services", servicesRoutes)
routes.use("/chamados", chamadosRoutes)

export { routes }