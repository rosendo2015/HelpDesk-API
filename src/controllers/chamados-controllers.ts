import { prisma } from "@/database/prisma"
import { Request, Response } from "express"
import { AppError } from "@/utils/AppError"

class ChamadosControllers {
    async index(request: Request, response: Response) {
        const chamados = await prisma.chamado.findMany()
        return response.json(chamados)
    }

    async create(request: Request, response: Response) {
        const { tecnicoId, horario, adminId, services } = request.body
        const clienteId = request.user?.id


        if (!clienteId) {
            throw new AppError("Cliente não autenticado", 401)
        }

        // 1. Validar disponibilidade
        const disponibilidade = await prisma.disponibilidade.findFirst({
            where: { tecnicoId, horario }
        })

        if (!disponibilidade) {
            throw new AppError("Técnico não disponível nesse horário", 400)
        }

        // 2. Calcular preço total
        const servicos = await prisma.service.findMany({
            where: { id: { in: services } }
        })
        const totalPrice = servicos.reduce((acc, s) => acc + s.price, 0)

        // 3. Criar chamado
        const chamado = await prisma.chamado.create({
            data: {
                clienteId,
                adminId,
                tecnicoId,
                status: "ABERTO",
                totalPrice,
                services: {
                    create: services.map((serviceId: string) => ({
                        serviceId
                    }))
                }
            },
            include: { services: true }
        })

        return response.status(201).json(chamado)
    }
}

export { ChamadosControllers }
