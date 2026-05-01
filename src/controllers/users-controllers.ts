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
                // não inclui password
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
        const user = await prisma.user.create({
            data: {
                name, email, password: hashedPassword, role
            }
        })
        const { password: _, ...userWithoutPassword } = user

        return response.status(201).json(userWithoutPassword)
    }
}
export { UserController }