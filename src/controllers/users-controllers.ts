import { prisma } from "@/database/prisma"
import { AppError } from "@/utils/AppError"
import { hash } from "bcrypt"
import { Request, Response } from "express"
import z from "zod"

class UserController {

    async index(request: Request, response: Response) {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return response.status(200).json(users);
    }

    async create(request: Request, response: Response) {
        const bodySchema = z.object({
            name: z.string().trim().min(3, { message: "O nome deve ter pelomenos 3 caracteres." }),
            email: z.email(),
            password: z.string().min(6),
            role: z.enum(["ADMIN", "TECNICO", "CLIENTE"])
        })
        const { name, email, password, role } = bodySchema.parse(request.body)
        const userWithSameEmail = await prisma.user.findUnique({ where: { email } })
        if (userWithSameEmail) {
            throw new AppError("Email already exist", 400)
        }
        const hashedPassword = await hash(password, 8)

        const defaultHours = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

        const user = await prisma.user.create({
            data: {
                name, email, password: hashedPassword, role
            }
        })

        // popula a tabela Disponibilidade
        if (role === "TECNICO") {
            await prisma.disponibilidade.createMany({
                data: defaultHours.map(horario => ({
                    horario,
                    tecnicoId: user.id
                }))
            })
        }

        const { password: _, ...userWithoutPassword } = user

        return response.status(201).json(userWithoutPassword)
    }

    async update(request: Request, response: Response) {
        const { id } = request.params

        const userId = Array.isArray(id) ? id[0] : id

        // Schema com todos os campos opcionais
        const bodySchema = z.object({
            name: z.string().trim().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }).optional(),
            email: z.string().email().optional(),
            password: z.string().min(6).optional(),
            avatarUrl: z.string().url().optional(),
            role: z.enum(["ADMIN", "TECNICO", "CLIENTE"]).optional()
        })

        const data = bodySchema.parse(request.body)

        if (request.user?.role === "ADMIN") {
            // ADMIN pode atualizar qualquer usuário
        } else if (request.user?.role === "TECNICO") {
            // TECNICO só pode atualizar o próprio perfil
            if (request.user.id !== userId) {
                throw new AppError("Você não tem permissão para atualizar outro usuário", 403);
            }
        } else {
            // CLIENTE só pode atualizar o próprio perfil também
            if (request.user?.id !== userId) {
                throw new AppError("Você não tem permissão para atualizar outro usuário", 403);
            }
        }

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new AppError("Usuário não encontrado", 404)
        }

        if (data.password) {
            data.password = await hash(data.password, 8)
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data
        })

        const { password, ...userWithoutPassword } = updatedUser

        return response.status(200).json(userWithoutPassword)

    }
}
export { UserController }