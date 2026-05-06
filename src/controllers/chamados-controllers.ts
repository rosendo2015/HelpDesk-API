import { prisma } from "@/database/prisma"
import { Request, Response } from "express"
import { AppError } from "@/utils/AppError"

class ChamadosControllers {
    async index(request: Request, response: Response) {
        const chamados = await prisma.chamado.findMany({
            include: {
                disponibilidade: true,
                tecnico: true,
                cliente: true,
                services: { include: { service: true } }
            }
        })
        return response.json(chamados)
    }

    async create(request: Request, response: Response) {
        const { tecnicoId, disponibilidadeId, adminId, services } = request.body
        const clienteId = request.user?.id

        if (!clienteId) {
            throw new AppError("Cliente não autenticado", 401)
        }

        // 1. Validar se a disponibilidade existe e pertence ao técnico
        const disponibilidade = await prisma.disponibilidade.findUnique({
            where: { id: disponibilidadeId }
        })

        if (!disponibilidade || disponibilidade.tecnicoId !== tecnicoId) {
            throw new AppError("Disponibilidade inválida para esse técnico", 400)
        }

        // 1.1 Verificar se já existe chamado vinculado a essa disponibilidade
        const chamadoExistente = await prisma.chamado.findFirst({
            where: { disponibilidadeId, status: { not: "ENCERRADO" } }
        })

        if (chamadoExistente) {
            throw new AppError("Já existe um chamado para esse técnico nesse horário", 400)
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
                disponibilidadeId,
                status: "ABERTO",
                totalPrice,
                services: {
                    create: services.map((serviceId: string) => ({ serviceId }))
                }
            },
            include: {
                disponibilidade: true,
                tecnico: true,
                cliente: true,
                services: { include: { service: true } }
            }
        })

        return response.status(201).json(chamado)
    }
}

export { ChamadosControllers }
