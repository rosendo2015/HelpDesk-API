import { authConfig } from "@/configs/auth";
import { prisma } from "@/database/prisma";
import { AppError } from "@/utils/AppError";
import { compare, hash } from "bcrypt";
import { Request, Response, NextFunction } from "express";
import { SignOptions } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import z from "zod";

class UserController {
  async index(request: Request, response: Response, next: NextFunction) {
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

  async create(request: Request, response: Response, next: NextFunction) {
    try {
      const bodySchema = z.object({
        name: z
          .string()
          .trim()
          .min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["ADMIN", "TECNICO", "CLIENTE"]),
        horarios: z.array(z.string()).optional(), // <-- adiciona horários opcionais
      });

      const { name, email, password, role, horarios } = bodySchema.parse(
        request.body,
      );

      const userWithSameEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (userWithSameEmail) throw new AppError("Email já existe", 400);

      const hashedPassword = await hash(password, 8);

      const defaultHours = [
        "08:00",
        "09:00",
        "10:00",
        "11:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
      ];

      const user = await prisma.user.create({
        data: { name, email, password: hashedPassword, role },
      });

      // Popula a tabela Disponibilidade para técnicos
      if (role === "TECNICO") {
        const horasParaSalvar =
          horarios && horarios.length > 0 ? horarios : defaultHours;

        await prisma.disponibilidade.createMany({
          data: horasParaSalvar.map((horario) => ({
            horario,
            tecnicoId: user.id,
          })),
        });
      }

      // Gera token JWT
      const { secret, expiresIn } = authConfig.jwt;
      const options: SignOptions = {
        subject: String(user.id),
        expiresIn: expiresIn as any,
      };
      const token = jwt.sign({ role: user.role }, secret, options);

      const { password: _, ...userWithoutPassword } = user;
      return response.status(201).json({ user: userWithoutPassword, token });
    } catch (error) {
      next(error);
    }
  }

  async update(request: Request, response: Response) {
    const { id } = request.params;
    const userId = Array.isArray(id) ? id[0] : id;

    const bodySchema = z.object({
      name: z.string().trim().min(3).optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      avatarUrl: z.string().url().optional(),
      role: z.enum(["ADMIN", "TECNICO", "CLIENTE"]).optional(),
      horarios: z.array(z.string()).optional(), // ✅ adiciona horários
    });

    const data = bodySchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("Usuário não encontrado", 404);

    const { horarios, ...userData } = data;

    console.log(data);

    // Atualiza dados básicos
    if (userData.password) {
      userData.password = await hash(userData.password, 8);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      if (user.role === "TECNICO" && horarios) {
        await tx.disponibilidade.deleteMany({ where: { tecnicoId: userId } });
        await tx.disponibilidade.createMany({
          data: horarios.map((horario) => ({ horario, tecnicoId: userId })),
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: { ...userData },
        include: { disponibilidades: true },
      });
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return response.status(200).json(userWithoutPassword);
  }

  async updatePassword(
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = request.params;
      const userId = Array.isArray(id) ? id[0] : id;
      const bodySchema = z.object({
        oldPassword: z.string().min(1, {
          message: "Informe a senha atual. Não deve ficar em branco.",
        }),
        newPassword: z
          .string()
          .min(6, { message: "A nova senha deve ter no mínimo 6 caracteres" }),
      });
      const { oldPassword, newPassword } = bodySchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError("Usuário nãi encontrado", 404);
      }
      const passwordMatches = await compare(oldPassword, user.password);
      if (!passwordMatches) {
        throw new AppError("Senha atual incorreta.", 401);
      }
      const hashedPassword = await hash(newPassword, 8);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
      return response
        .status(200)
        .json({ message: "Senha atualizada com sucesso." });
    } catch (error) {
      next(error);
    }
  }

  async listAdmins(request: Request, response: Response) {
    // Busca todos os usuários com role ADMIN
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return response.status(200).json(admins);
  }

  async listTecnicos(request: Request, response: Response, next: NextFunction) {
    try {
      const tecnicos = await prisma.user.findMany({
        where: { role: "TECNICO" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          disponibilidades: {
            select: { horario: true },
          },
        },
      });

      return response.status(200).json(tecnicos);
    } catch (error) {
      console.error("Erro ao listar técnicos:", error);
      return response.status(500).json({ message: "Erro ao listar técnicos" });
    }
  }

  async show(request: Request, response: Response, next: NextFunction) {
    try {
      const { id } = request.params;
      const userId = Array.isArray(id) ? id[0] : id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
          disponibilidades: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new AppError("Usuário não encontrado", 404);
      }

      return response.status(200).json(user);
    } catch (error) {
      next(error); // 🔹 garante que o servidor não caia
    }
  }

  async listClientes(request: Request, response: Response, next: NextFunction) {
    try {
      const clientes = await prisma.user.findMany({
        where: { role: "CLIENTE" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return response.status(200).json(clientes);
    } catch (error) {
      next(error);
    }
  }

  async delete(request: Request, response: Response, next: NextFunction) {
    try {
      const { id } = request.params;
      const userId = Array.isArray(id) ? id[0] : id;

      if (request.user?.role !== "ADMIN") {
        throw new AppError("Você não tem permissão para excluir usuários", 403);
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError("Usuário não encontrado", 404);
      }

      // Agora permite excluir ADMIN, TECNICO e CLIENTE
      if (user.role === "ADMIN") {
        await prisma.user.delete({ where: { id: userId } });
        return response
          .status(200)
          .json({ message: "Administrador excluído com sucesso" });
      }

      if (user.role === "TECNICO") {
        // Verifica se existem chamados atribuídos ao técnico
        const chamadosDoTecnico = await prisma.chamado.findMany({
          where: { tecnicoId: userId },
        });

        if (chamadosDoTecnico.length > 0) {
          throw new AppError(
            "Este técnico possui chamados atribuídos. Reatribua os chamados a outro técnico antes de excluir.",
            400,
          );
        }

        // Se não houver chamados, pode excluir as disponibilidades e o usuário
        await prisma.disponibilidade.deleteMany({
          where: { tecnicoId: userId },
        });
        await prisma.user.delete({ where: { id: userId } });

        return response
          .status(200)
          .json({ message: "Técnico excluído com sucesso" });
      }

      if (user.role === "CLIENTE") {
        await prisma.chamadoService.deleteMany({
          where: { chamado: { clienteId: userId } },
        });
        await prisma.user.delete({ where: { id: userId } });
        return response
          .status(200)
          .json({ message: "Cliente excluído com sucesso" });
      }
      console.log("=== Role recebido do banco: ==== ", user.role);
      throw new AppError("Tipo de usuário não suportado para exclusão", 400);
    } catch (error) {
      next(error);
    }
  }
}
export { UserController };
