import { DisponibilidadesController } from "@/controllers/disponibilidades-controllers";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization";
import { Router } from "express";

const disponibilidadesRoutes = Router()
const disponibilidadesControllers = new DisponibilidadesController()

disponibilidadesRoutes.patch("/:tecnicoId",
    ensureAuthenticated,
    verifyUserAuthorization(["ADMIN"]),
    disponibilidadesControllers.update
)

disponibilidadesRoutes.get("/:tecnicoId",
    ensureAuthenticated,
    disponibilidadesControllers.index
)

disponibilidadesRoutes.get("/detalhes/:tecnicoId",
    ensureAuthenticated,
    disponibilidadesControllers.show
)

export { disponibilidadesRoutes }