import { prisma } from "@/database/prisma";
import { Request, Response } from "express";

class DisponibilidadesController {
    async index(request: Request, response: Response) {
        const tecnicoId = request.params.tecnicoId as string

        const horarios = await prisma.disponibilidade.findMany({ where: { tecnicoId } })
        return response.json(horarios)
    }

    async show(request: Request, response: Response) {
        const tecnicoId = request.params.tecnicoId as string

        const tecnico = await prisma.user.findUnique({
            where: { id: tecnicoId },
            include: {
                disponibilidades: {
                    select: {
                        id: true, horario: true
                    }
                }
            }
        })
        if (!tecnico) {
            return response.status(404).json({ message: "Tecnico não encontrado." })
        }
        return response.json(tecnico)
    }

    async update(request: Request, response: Response) {
        const tecnicoId = request.params.tecnicoId as string
        const { horarios } = request.body

        await prisma.disponibilidade.deleteMany({ where: { tecnicoId } })

        await prisma.disponibilidade.createMany({
            data: horarios.map((h: string) => ({
                horario: h,
                tecnicoId
            }))
        })
        return response.json({ message: "Horaios atualizados." })
    }
}

export { DisponibilidadesController }