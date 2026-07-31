import { prisma } from "@/database/prisma";
import { Request, Response } from "express";
import { AppError } from "@/utils/AppError";

class ServicesController {
  async create(request: Request, response: Response) {
    const { name, price, active } = request.body;
    const adminId = request.user?.id; // pega do usuário logado

    if (!adminId) {
      throw new AppError("Somente admin pode criar serviços", 403);
    }

    const service = await prisma.service.create({
      data: {
        name,
        price,
        active,
        adminId,
      },
    });

    return response.status(201).json(service);
  }

  async index(request: Request, response: Response) {
    const includeInactive = request.query.includeInactive === "true";
    const userRole = request.user?.role; // supondo que você tenha o role no objeto user

    let services;

    if (includeInactive) {
      if (userRole !== "ADMIN") {
        throw new AppError("Somente admin pode ver serviços inativos", 403);
      }
      services = await prisma.service.findMany(); // todos
    } else {
      services = await prisma.service.findMany({
        where: { active: true }, // só ativos
      });
    }

    return response.json(services);
  }

  async update(request: Request, response: Response) {
    const { id } = request.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { name, price, active } = request.body;

    const service = await prisma.service.update({
      where: { id: userId },
      data: { name, price, active },
    });

    return response.json(service);
  }
}

export { ServicesController };
