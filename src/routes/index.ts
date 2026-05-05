import { Router } from "express";
import { usersRoutes } from "./users-routes";
import { sessionsRoutes } from "./sessions-routes";
import { disponibilidadesRoutes } from "./disponibilidades-routes";
import { servicesRoutes } from "./services-routes";
import { chamadosRoutes } from "./chamados-routes";

const routes = Router()

routes.use("/users", usersRoutes)
routes.use("/sessions", sessionsRoutes)
routes.use("/disponibilidades", disponibilidadesRoutes)
routes.use("/services", servicesRoutes)
routes.use("/chamados", chamadosRoutes)

export { routes }