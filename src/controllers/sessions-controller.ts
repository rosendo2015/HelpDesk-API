import { Request, Response, NextFunction } from "express";
import { prisma } from "@/database/prisma"
import { AppError } from "@/utils/AppError";
import { compare } from "bcrypt";
import z from "zod";
import { authConfig } from "@/configs/auth";
import jwt, { SignOptions } from "jsonwebtoken"

class SessionsController {
    async create(request: Request, response: Response, next: NextFunction) {
        try {
            const bodySchema = z.object({
                email: z.email({ message: "Email invalid" }),
                password: z.string()
            })
            const { email, password } = bodySchema.parse(request.body)
            const user = await prisma.user.findFirst({ where: { email } })
            if (!user) {
                throw new AppError("Email or Password invalid", 401)
            }
            const passwordMatched = await compare(password, user.password)
            if (!passwordMatched) {
                throw new AppError("Email or Password invalid", 401)
            }
            const { secret, expiresIn } = authConfig.jwt
            const options: SignOptions = {
                subject: String(user.id),
                expiresIn: "1d"
            }
            const token = jwt.sign({ role: user.role ?? "ADMIN" }, secret, options)

            const { password: _, ...userWithoutPassword } = user

            return response.json({ token, user })

        } catch (error) {
            next(error)
        }
    }
}
export { SessionsController }