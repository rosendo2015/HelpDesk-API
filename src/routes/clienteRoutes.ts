// src/routes/clienteRoutes.ts
import { Router } from "express";
import { ClienteController } from "@/controllers/clienteController";

const clienteRoutes = Router();
const clienteController = new ClienteController();

clienteRoutes.post("/", clienteController.criar);

export { clienteRoutes };

