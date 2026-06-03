// src/controllers/ClienteController.ts
import { Request, Response } from "express";
import { prisma } from "@/database/prisma";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const clienteSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6),
    avatarUrl: z.string().url().optional(),
    role: z.string().default("CLIENTE")
});

export class ClienteController {
    async criar(request: Request, response: Response) {
        try {
            const parsed = clienteSchema.parse(request.body);

            const existing = await prisma.user.findUnique({
                where: { email: parsed.email }
            });

            if (existing) {
                return response.status(400).json({ error: "Email já cadastrado" });
            }

            const hashedPassword = await bcrypt.hash(parsed.password, 10);

            const cliente = await prisma.user.create({
                data: {
                    name: parsed.name,
                    email: parsed.email,
                    password: hashedPassword,
                    avatarUrl: parsed.avatarUrl,
                    role: "CLIENTE"
                }
            });

            const token = jwt.sign(
                { id: cliente.id, role: "CLIENTE" },
                process.env.JWT_SECRET as string,
                { expiresIn: "1d" }
            );

            return response.status(201).json({ cliente, token });
        } catch (error: any) {
            return response.status(400).json({ error: error.message });
        }
    }
}
