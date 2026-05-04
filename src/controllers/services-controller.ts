import { prisma } from "@/database/prisma"
import { Request, Response } from "express"
import { AppError } from "@/utils/AppError"

class ServicesController {
    async create(request: Request, response: Response) {
        const { name, description, price, active } = request.body
        const adminId = request.user?.id // pega do usuário logado

        if (!adminId) {
            throw new AppError("Somente admin pode criar serviços", 403)
        }

        const service = await prisma.service.create({
            data: {
                name,
                description,
                price,
                active,
                adminId
            }
        })

        return response.status(201).json(service)
    }

    async index(request: Request, response: Response) {
        const services = await prisma.service.findMany({
            where: { active: true } // só lista serviços ativos
        })
        return response.json(services)
    }

    async update(request: Request, response: Response) {
        const { id } = request.params
        const { name, description, price, active } = request.body

        const service = await prisma.service.update({
            where: { id },
            data: { name, description, price, active }
        })

        return response.json(service)
    }
}

export { ServicesController }

