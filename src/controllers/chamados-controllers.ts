import { prisma } from "@/database/prisma"
import { NextFunction, Request, Response } from "express"
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

    async update(request: Request, response: Response) {
        const { id } = request.params
        const chamadoId = Array.isArray(id) ? id[0] : id
        const { tecnicoId, disponibilidadeId, status, services } = request.body

        // 1. Verificar se o chamado existe
        const chamado = await prisma.chamado.findUnique({ where: { id: chamadoId } })
        if (!chamado) {
            throw new AppError("Chamado não encontrado", 404)
        }

        // 2. Validar disponibilidade se informada junto com técnico
        if (tecnicoId && disponibilidadeId) {
            const disponibilidade = await prisma.disponibilidade.findUnique({
                where: { id: disponibilidadeId }
            })

            if (!disponibilidade || disponibilidade.tecnicoId !== tecnicoId) {
                throw new AppError("Disponibilidade inválida para esse técnico", 400)
            }
        }

        // 3. Atualizar serviços e recalcular preço se necessário
        let totalPrice = chamado.totalPrice
        if (services && Array.isArray(services) && services.length > 0) {
            const servicos = await prisma.service.findMany({
                where: { id: { in: services } }
            })
            totalPrice = servicos.reduce((acc, s) => acc + s.price, 0)

            // Remove serviços antigos
            await prisma.chamadoService.deleteMany({ where: { chamadoId } })

            // Adiciona novos serviços
            await prisma.chamadoService.createMany({
                data: services.map((serviceId: string) => ({
                    chamadoId,
                    serviceId
                }))
            })
        }

        // 4. Atualizar chamado
        const chamadoAtualizado = await prisma.chamado.update({
            where: { id: chamadoId },
            data: {
                tecnicoId,
                disponibilidadeId,
                status,
                totalPrice
            },
            include: {
                disponibilidade: true,
                tecnico: true,
                cliente: true,
                services: { include: { service: true } }
            }
        })

        return response.status(200).json(chamadoAtualizado)
    }

    async listByTecnico(request: Request, response: Response, next: NextFunction) {
        try {

            const { id } = request.params
            const tecnicoId = Array.isArray(id) ? id[0] : id

            // Verifica se o técnico existe
            const tecnico = await prisma.user.findUnique({
                where: { id: tecnicoId }
            })

            if (!tecnico || tecnico.role !== "TECNICO") {
                throw new AppError("Técnico não encontrado", 404)
            }
            // Busca os chamados atribuídos ao técnico
            const chamados = await prisma.chamado.findMany({
                where: { tecnicoId, status: { not: "ENCERRADO" } },
                include: {
                    disponibilidade: true,
                    tecnico: true,
                    cliente: true,
                    services: { include: { service: true } }
                }
            })

            return response.status(200).json(chamados)

        } catch (error) {
            next(error)
        }
    }


}

export { ChamadosControllers }
