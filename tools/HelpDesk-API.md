
## .env

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/task_manager?schema=public"

JWT_SECRET="r0s3nd0"

APP_API_URL="http://localhost:3333"
```

## package.json

```json
{
  "name": "helpdesk-api",
  "version": "1.0.0",
  "description": "api do sistema HelpDesk",
  "main": "index.js",
  "scripts": {
    "dev": "tsx --watch --env-file .env src/server.ts",
    "generate-md": "node --loader ts-node/esm tools/generate-md.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "author": "Francisco Rosendo",
  "license": "ISC",
  "type": "module",
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.1.1",
    "pg": "^8.20.0",
    "tsconfig-paths": "^4.2.0",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/connect-livereload": "^0.6.3",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/livereload": "^0.9.5",
    "@types/multer": "^2.1.0",
    "@types/node": "^25.9.4",
    "@types/pg": "^8.20.0",
    "livereload": "^0.10.3",
    "prisma": "^7.8.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3"
  }
}

```

## prisma.config.ts

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { env } from "./src/env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env["DATABASE_URL"],
  },
});

```

## src\app.ts

```ts
import express from "express";
import { errorHandling } from "@/middleware/error-handling";
import { routes } from "@/routes";
import uploadConfig from "./configs/upload";
import cors from "cors";
import { prisma } from "./database/prisma";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // ou "*", se quiser liberar tudo
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use("/files", express.static(uploadConfig.UPLOADS_FOLDER));

//rota para verificar se o BD está online
app.get("/health", async (req, res) => {
  try {
    await prisma.$connect(); // garante que a conexão está ativa
    await prisma.$queryRawUnsafe("SELECT 1"); // comando válido no Postgres
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Erro no health check:", err);
    res.status(500).json({ status: "error", message: "DB indisponível" });
  } finally {
    await prisma.$disconnect(); // opcional, se quiser encerrar após o teste
  }
});

app.use(routes);
app.use(errorHandling);

export { app };

```

## src\configs\auth.ts

```ts
import { env } from "@/env";
import { SignOptions } from "jsonwebtoken";

export interface AuthConfig {
    jwt: {
        secret: string;
        expiresIn: SignOptions["expiresIn"];
    };
}

export const authConfig: AuthConfig = {
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: "1d"
    }
};

```

## src\configs\upload.ts

```ts
import multer from "multer"
import crypto from "node:crypto"
import path from "node:path"

const TMP_FOLDER = path.resolve(__dirname, "..", "..", "tmp")
const UPLOADS_FOLDER = path.resolve(TMP_FOLDER, "uploads")
const MAX_SIZE = 3
const MAX_FILE_SIZE = 1024 * 1024 * MAX_SIZE
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"]

const MULTER = {
    storage: multer.diskStorage({
        destination: TMP_FOLDER,
        filename(request, file, callback) {
            const fileHash = crypto.randomBytes(10).toString("hex")
            const fileName = `${fileHash}-${file.originalname}`

            return callback(null, fileName)
        }
    })
}

export default {
    TMP_FOLDER,
    UPLOADS_FOLDER,
    MULTER,
    MAX_SIZE,
    MAX_FILE_SIZE,
    ACCEPTED_IMAGE_TYPES
}
```

## src\controllers\chamados-controllers.ts

```ts
import { prisma } from "@/database/prisma";
import { NextFunction, Request, Response } from "express";
import { AppError } from "@/utils/AppError";

class ChamadosControllers {
  async index(request: Request, response: Response) {
    const { id, role } = request.user!;

    let where = {};

    switch (role) {
      case "CLIENTE":
        where = {
          clienteId: id,
        };
        break;

      case "TECNICO":
        where = {
          tecnicoId: id,
        };
        break;

      case "ADMIN":
        where = {};
        break;
    }

    const chamados = await prisma.chamado.findMany({
      where,
      include: {
        disponibilidade: true,
        tecnico: true,
        cliente: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    const chamadosFormatados = chamados.map((chamado) => ({
      id: chamado.id,
      title: chamado.title,
      description: chamado.description,
      status: chamado.status,
      createdAt: chamado.createdAt,
      updatedAt: chamado.updatedAt,
      totalPrice: chamado.totalPrice,
      cliente: { id: chamado.cliente.id, name: chamado.cliente.name },
      tecnico: chamado.tecnico
        ? {
            id: chamado.tecnico.id,
            name: chamado.tecnico.name,
            email: chamado.tecnico.email,
          }
        : null,
      services: chamado.services.map((s) => ({
        id: s.service.id,
        nome: s.service.name,
        price: s.service.price,
      })),
    }));

    return response.json(chamadosFormatados);
  }

  async create(request: Request, response: Response) {
    const { services, title, description } = request.body;
    const clienteId = request.user?.id;

    if (!clienteId) {
      throw new AppError("Cliente não autenticado", 401);
    }

    // 1. Calcular preço total
    const servicos = await prisma.service.findMany({
      where: { id: { in: services } },
    });
    const totalPrice = servicos.reduce((acc, s) => acc + s.price, 0);

    // 2. Escolher admin automaticamente
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    const adminEscolhido = admins[Math.floor(Math.random() * admins.length)];

    if (!adminEscolhido) {
      throw new AppError("Nenhum admin disponível", 400);
    }

    // 3. Escolher técnico automaticamente
    const tecnicos = await prisma.user.findMany({
      where: { role: "TECNICO" },
      include: { chamadosTecnico: true, disponibilidades: true },
    });
    const disponiveis = tecnicos.filter((t) => t.disponibilidades.length > 0);

    const pool: typeof disponiveis = [];
    disponiveis.forEach((t) => {
      const ativos = t.chamadosTecnico.filter(
        (c) => c.status !== "ENCERRADO",
      ).length;
      const peso = Math.max(1, 5 - ativos);
      for (let i = 0; i < peso; i++) pool.push(t);
    });

    if (pool.length === 0) {
      throw new AppError("Nenhum técnico disponível", 400);
    }

    const tecnicoEscolhido = pool[Math.floor(Math.random() * pool.length)];
    const disponibilidadeEscolhida = tecnicoEscolhido.disponibilidades[0];

    // 4. Criar chamado já com os IDs automáticos
    try {
      const chamado = await prisma.chamado.create({
        data: {
          clienteId,
          adminId: adminEscolhido.id,
          tecnicoId: tecnicoEscolhido.id,
          disponibilidadeId: disponibilidadeEscolhida.id,
          status: "ABERTO",
          totalPrice,
          title,
          description,
          services: {
            createMany: {
              data: services.map((serviceId: string) => ({ serviceId })),
            },
          },
        },
      });

      return response.status(201).json({
        id: chamado.id,
        title: chamado.title,
        description: chamado.description,
        status: chamado.status,
        createdAt: chamado.createdAt,
        updatedAt: chamado.updatedAt,
        totalPrice: chamado.totalPrice,
        cliente: {
          id: clienteId,
          name: (await prisma.user.findUnique({ where: { id: clienteId } }))
            ?.name,
        },
        tecnico: { id: tecnicoEscolhido.id, name: tecnicoEscolhido.name },
        services: servicos.map((s) => ({
          id: s.id,
          nome: s.name,
          price: s.price,
        })),
      });
    } catch (error) {
      console.error("Erro ao criar chamado", error);
      return response.status(500).json({ message: "Erro interno", error });
    }
  }

  async update(request: Request, response: Response) {
    const { id } = request.params;
    const chamadoId = Array.isArray(id) ? id[0] : id;
    const {
      tecnicoId,
      disponibilidadeId,
      status,
      services,
      title,
      description,
    } = request.body;

    // 1. Verificar se o chamado existe
    const chamado = await prisma.chamado.findUnique({
      where: { id: chamadoId },
    });
    if (!chamado) {
      throw new AppError("Chamado não encontrado", 404);
    }

    // 2. Validar disponibilidade se informada junto com técnico
    if (tecnicoId && disponibilidadeId) {
      const disponibilidade = await prisma.disponibilidade.findUnique({
        where: { id: disponibilidadeId },
      });

      if (!disponibilidade || disponibilidade.tecnicoId !== tecnicoId) {
        throw new AppError("Disponibilidade inválida para esse técnico", 400);
      }
    }

    // 3. Atualizar serviços e recalcular preço se necessário
    let totalPrice = chamado.totalPrice;
    if (services && Array.isArray(services) && services.length > 0) {
      const servicos = await prisma.service.findMany({
        where: { id: { in: services } },
      });
      totalPrice = servicos.reduce((acc, s) => acc + s.price, 0);

      // Remove serviços antigos
      await prisma.chamadoService.deleteMany({ where: { chamadoId } });

      // Adiciona novos serviços
      await prisma.chamadoService.createMany({
        data: services.map((serviceId: string) => ({
          chamadoId,
          serviceId,
        })),
      });
    }

    // 4. Atualizar chamado
    const chamadoAtualizado = await prisma.chamado.update({
      where: { id: chamadoId },
      data: {
        tecnicoId,
        disponibilidadeId,
        status: status ?? chamado.status,
        totalPrice,
        title,
        description,
      },
      include: {
        disponibilidade: true,
        tecnico: true,
        cliente: true,
        services: { include: { service: true } },
      },
    });

    return response.status(200).json(chamadoAtualizado);
  }

  async listByTecnico(
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = request.params;
      const tecnicoId = Array.isArray(id) ? id[0] : id;

      // Verifica se o técnico existe
      const tecnico = await prisma.user.findUnique({
        where: { id: tecnicoId },
      });

      if (!tecnico || tecnico.role !== "TECNICO") {
        throw new AppError("Técnico não encontrado", 404);
      }
      // Busca os chamados atribuídos ao técnico
      const chamados = await prisma.chamado.findMany({
        where: { tecnicoId, status: { not: "ENCERRADO" } },
        include: {
          disponibilidade: true,
          tecnico: true,
          cliente: true,
          services: { include: { service: true } },
        },
      });

      return response.status(200).json(chamados);
    } catch (error) {
      next(error);
    }
  }
}

export { ChamadosControllers };

```

## src\controllers\disponibilidades-controllers.ts

```ts
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
```

## src\controllers\services-controller.ts

```ts
import { prisma } from "@/database/prisma";
import { Request, Response } from "express";
import { AppError } from "@/utils/AppError";

class ServicesController {
  async create(request: Request, response: Response) {
    const { name, price, active } = request.body;
    const adminId = request.user?.id; // pega do usuário logado

    if (!adminId) {
      throw new AppError("Somente admin pode criar serviços", 403);
    }

    const service = await prisma.service.create({
      data: {
        name,
        price,
        active,
        adminId,
      },
    });

    return response.status(201).json(service);
  }

  async index(request: Request, response: Response) {
    const includeInactive = request.query.includeInactive === "true";
    const userRole = request.user?.role; // supondo que você tenha o role no objeto user

    let services;

    if (includeInactive) {
      if (userRole !== "ADMIN") {
        throw new AppError("Somente admin pode ver serviços inativos", 403);
      }
      services = await prisma.service.findMany(); // todos
    } else {
      services = await prisma.service.findMany({
        where: { active: true }, // só ativos
      });
    }

    return response.json(services);
  }

  async update(request: Request, response: Response) {
    const { id } = request.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { name, price, active } = request.body;

    const service = await prisma.service.update({
      where: { id: userId },
      data: { name, price, active },
    });

    return response.json(service);
  }
}

export { ServicesController };

```

## src\controllers\sessions-controller.ts

```ts
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

            return response.json({
                token,
                user: userWithoutPassword
            });

        } catch (error) {
            next(error)
        }
    }
}
export { SessionsController }
```

## src\controllers\user-avatar-controller.ts

```ts
import { NextFunction, Request, Response } from "express";
import { DiskStorage } from "@/providers/disk-storage";
import { prisma } from "@/database/prisma";
import path from "path";
import uploadConfig from "@/configs/upload";

class UserAvatarController {
  async index(request: Request, response: Response, next: NextFunction) {
    try {
      if (!request.user) {
        return response.status(401).json({ error: "Usuário não autenticado" });
      }

      const userId = request.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      if (!user || !user.avatarUrl) {
        return response.status(404).json({ error: "Avatar não encontrado" });
      }

      // Caminho completo do arquivo
      const filePath = path.resolve(
        uploadConfig.UPLOADS_FOLDER,
        user.avatarUrl,
      );

      // Envia o arquivo diretamente
      return response.sendFile(filePath);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
  async update(request: Request, response: Response, next: NextFunction) {
    try {
      const diskStorage = new DiskStorage();

      if (!request.user) {
        return response.status(401).json({ error: "Usuário não autenticado" });
      }
      const userId = request.user.id; // vem do middleware de autenticação

      if (!request.file) {
        return response.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      //Busca o arquivo antigo antes de substituir
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          avatarUrl: true,
        },
      });
      // Salva o novo arquivo
      const filename = await diskStorage.saveFile(request.file.filename);

      // Atualiza o banco com novo avatar
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: filename },
      });

      // Deleta o avatar antigo
      if (user?.avatarUrl) {
        await diskStorage.deleteFile(user.avatarUrl, "upload");
      }

      return response.status(200).json({ avatarUrl: filename });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
  async delete(request: Request, response: Response, next: NextFunction) {
    try {
      const diskStorage = new DiskStorage();

      if (!request.user) {
        return response.status(401).json({
          error: "Usuário não autenticado",
        });
      }

      const userId = request.user.id;

      // Busca avatar atual
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          avatarUrl: true,
        },
      });

      if (!user?.avatarUrl) {
        return response.status(404).json({
          error: "Usuário não possui avatar",
        });
      }

      // Remove arquivo físico
      await diskStorage.deleteFile(user.avatarUrl, "upload");

      // Remove referência no banco
      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          avatarUrl: null,
        },
      });

      return response.status(200).json(updatedUser);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
}

export { UserAvatarController };

```

## src\controllers\users-controllers.ts

```ts
import { authConfig } from "@/configs/auth";
import { prisma } from "@/database/prisma";
import { AppError } from "@/utils/AppError";
import { hash } from "bcrypt";
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

    const { password, ...userWithoutPassword } = user;
    return response.status(200).json(userWithoutPassword);
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

  async listClientes(request: Request, response: Response) {
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

```

## src\database\prisma.ts

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/client';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? [] : ["query"],
});
```

## src\env.ts

```ts
import { z } from "zod"

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string(),
    APP_API_URL: z.string().url()
})

export const env = envSchema.parse(process.env)
```

## src\middleware\ensure-authenticated.ts

```ts
import { authConfig } from "@/configs/auth";
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken"

interface TokenPayload {
    role: string,
    sub: string
}

function ensureAuthenticated(
    request: Request, response: Response, next: NextFunction
) {
    try {
        const authHeader = request.headers.authorization
        if (!authHeader) {
            throw new AppError("JWT token is missing", 401)
        }
        const [, token] = authHeader.split(" ")



        if (!token) {
            throw new AppError("JWT token is missing", 401)
        }
        const { role, sub: user_id } = jwt.verify(token, authConfig.jwt.secret) as TokenPayload



        request.user = { id: user_id, role }



        return next()
    } catch (error) {
        throw new AppError("Invalid JWT token", 401)
    }
}
export { ensureAuthenticated }
```

## src\middleware\error-handling.ts

```ts
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandling(
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (error instanceof AppError) {
        return response.status(error.statusCode).json({
            status: "error",
            message: error.message
        })
    }
    if (error instanceof ZodError) {
        const formattedIssues = error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
        }))
        return response.status(400).json({
            status: "FAIL",
            message: "Validation error",
            issues: formattedIssues
        })
    }
    return response.status(500).json({
        status: "error",
        message: error.message
    })
}
```

## src\middleware\verifyUserAuthorization.ts

```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";

function verifyUserAuthorization(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            throw new AppError("Usuário não autenticado", 401);
        }

        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError("Usuário não autorizado", 403);
        }

        return next();
    };
}



export { verifyUserAuthorization }
```

## src\providers\disk-storage.ts

```ts
import uploadConfig from "@/configs/upload";
import fs from "node:fs";
import path from "node:path";

class DiskStorage {
  async saveFile(file: string) {
    const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file);
    const destPath = path.resolve(uploadConfig.UPLOADS_FOLDER, file);
    try {
      await fs.promises.access(tmpPath);
    } catch (error) {
      console.log(error);
      throw new Error(`Arquivo não encontrado: ${tmpPath}`);
    }
    await fs.promises.mkdir(uploadConfig.UPLOADS_FOLDER, { recursive: true });
    await fs.promises.rename(tmpPath, destPath);
    return file;
  }

  async deleteFile(file: string, type: "tmp" | "upload") {
    const folder =
      type === "tmp" ? uploadConfig.TMP_FOLDER : uploadConfig.UPLOADS_FOLDER;

    const filePath = path.resolve(folder, file);

    try {
      await fs.promises.unlink(filePath);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export { DiskStorage };

```

## src\routes\chamados-routes.ts

```ts
import { Router } from "express"
import { ChamadosControllers } from "@/controllers/chamados-controllers"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization"

const chamadosRoutes = Router()
const chamadosControllers = new ChamadosControllers()

// Criar chamado (cliente)
chamadosRoutes.post("/",
    ensureAuthenticated,
    verifyUserAuthorization(["CLIENTE"]),
    chamadosControllers.create
)

// Listar chamados (filtra por role)
chamadosRoutes.get("/",
    ensureAuthenticated,
    chamadosControllers.index
)

// Listar chamados de um tecnico especifico 
chamadosRoutes.get("/tecnico/:id",
    ensureAuthenticated,
    chamadosControllers.listByTecnico
)

// Update chamados - passe o id do chamado
chamadosRoutes.patch("/:id",
    ensureAuthenticated,
    chamadosControllers.update
)

export { chamadosRoutes }

```

## src\routes\disponibilidades-routes.ts

```ts
import { DisponibilidadesController } from "@/controllers/disponibilidades-controllers";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization";
import { Router } from "express";

const disponibilidadesRoutes = Router()
const disponibilidadesControllers = new DisponibilidadesController()

disponibilidadesRoutes.patch("/:tecnicoId",
    ensureAuthenticated,
    verifyUserAuthorization(["ADMIN"]),
    disponibilidadesControllers.update
)

disponibilidadesRoutes.get("/:tecnicoId",
    ensureAuthenticated,
    disponibilidadesControllers.index
)

disponibilidadesRoutes.get("/detalhes/:tecnicoId",
    ensureAuthenticated,
    disponibilidadesControllers.show
)

export { disponibilidadesRoutes }
```

## src\routes\index.ts

```ts
import { Router } from "express";
import { usersRoutes } from "./users-routes";
import { sessionsRoutes } from "./sessions-routes";
import { disponibilidadesRoutes } from "./disponibilidades-routes";
import { servicesRoutes } from "./services-routes";
import { chamadosRoutes } from "./chamados-routes";
import { AppError } from "@/utils/AppError";
import { userAvatarRoutes } from "./user-avatar-routes";


const routes = Router()

routes.get("/test-error", () => {
    throw new AppError("Erro de teste", 400)
})

routes.use("/users", usersRoutes)
routes.use("/user-avatar", userAvatarRoutes)
routes.use("/sessions", sessionsRoutes)
routes.use("/disponibilidades", disponibilidadesRoutes)
routes.use("/services", servicesRoutes)
routes.use("/chamados", chamadosRoutes)


export { routes }
```

## src\routes\services-routes.ts

```ts
import { Router } from "express"
import { ServicesController } from "@/controllers/services-controller"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization"

const servicesRoutes = Router()
const servicesController = new ServicesController()

// Admin cria e atualiza serviços
servicesRoutes.post("/", ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), servicesController.create)
servicesRoutes.patch("/:id", ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), servicesController.update)

// Qualquer usuário pode listar serviços ativos
servicesRoutes.get("/", ensureAuthenticated, servicesController.index)

export { servicesRoutes }

```

## src\routes\sessions-routes.ts

```ts
import { SessionsController } from "@/controllers/sessions-controller";
import { Router } from "express";

const sessionsRoutes = Router()
const sessionsController = new SessionsController()

sessionsRoutes.post("/", sessionsController.create)

export { sessionsRoutes }
```

## src\routes\user-avatar-routes.ts

```ts
import { Router } from "express";
import multer from "multer";
import uploadConfig from "@/configs/upload";
import { UserAvatarController } from "@/controllers/user-avatar-controller";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";

const userAvatarRoutes = Router();
const userAvatarController = new UserAvatarController();
const upload = multer(uploadConfig.MULTER);

userAvatarRoutes.post(
  "/avatar",
  ensureAuthenticated,
  upload.single("file"),
  userAvatarController.update,
);
userAvatarRoutes.get(
  "/avatar",
  ensureAuthenticated,
  userAvatarController.index,
);

userAvatarRoutes.delete(
  "/avatar",
  ensureAuthenticated,
  userAvatarController.delete,
);

export { userAvatarRoutes };

```

## src\routes\users-routes.ts

```ts
import { Router } from "express";
import { UserController } from "@/controllers/users-controllers";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization";
import { asyncHandler } from "@/utils/asyncHandler";
import { prisma } from "@/database/prisma";

const usersRoutes = Router();
const userController = new UserController();

/* -------------------------
   🔹 ROTAS DE LISTAGEM
------------------------- */

// Listar todos os usuários (somente ADMIN)
usersRoutes.get(
  "/",
  asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
      verifyUserAuthorization(["ADMIN"])(req, res, async () => {
        await userController.index(req, res, next);
      });
    });
  }),
);

// Listar todos os administradores
usersRoutes.get("/admins", ensureAuthenticated, userController.listAdmins);

// Listar todos os técnicos
usersRoutes.get("/tecnicos", ensureAuthenticated, userController.listTecnicos);

// Listar todos os clientes
usersRoutes.get("/clientes", ensureAuthenticated, userController.listClientes);

/* -------------------------
   🔹 ROTAS DE CONSULTA INDIVIDUAL
------------------------- */

// Buscar um único usuário
usersRoutes.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, async () => {
      await userController.show(req, res, next);
    });
  }),
);

// Atualizar usuário (Admin pode atualizar qualquer um, Técnico/Cliente só o próprio)
usersRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAuthenticated(req, res, async () => {
      await userController.update(req, res);
    });
  }),
);

// Excluir usuário (Admin pode excluir Admin, Técnico ou Cliente)
usersRoutes.delete(
  "/:id",
  asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
      verifyUserAuthorization(["ADMIN"])(req, res, async () => {
        await userController.delete(req, res, next);
      });
    });
  }),
);

/* -------------------------
   🔹 ROTAS DE CRIAÇÃO
------------------------- */

// Criar usuário (Admin, Técnico ou Cliente)
usersRoutes.post(
  "/",
  asyncHandler(async (req, res, next) => {
    const { role } = req.body;

    // Permite cadastro público de CLIENTE
    if (role === "CLIENTE") {
      return userController.create(req, res, next);
    }

    // Mantém regra para ADMIN e TECNICO
    const adminExists = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!adminExists && role === "ADMIN") {
      return userController.create(req, res, next);
    }

    ensureAuthenticated(req, res, () => {
      verifyUserAuthorization(["ADMIN"])(req, res, async () => {
        await userController.create(req, res, next);
      });
    });
  }),
);

export { usersRoutes };

```

## src\server.ts

```ts
import { app } from "@/app";

const PORT = 3333;

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`)
})
```

## src\types\express.d.ts

```ts
declare namespace Express {
    export interface Request {
        user?: {
            id: string
            role: string
        }
    }
}
```

## src\utils\AppError.ts

```ts
class AppError extends Error {
    public readonly statusCode: number

    constructor(message: string, statusCode: number = 400) {
        super(message)
        this.statusCode = statusCode
        Object.setPrototypeOf(this, AppError.prototype)
    }
}
export { AppError }
```

## src\utils\asyncHandler.ts

```ts
import { Request, Response, NextFunction } from "express"

export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}

```

## tools\generate-md.ts

```ts
import { readdirSync, statSync, readFileSync, appendFileSync, existsSync, unlinkSync } from "fs";
import { join, extname, dirname, resolve, relative, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// raiz do projeto (um nível acima de tools)
const projectPath = resolve(__dirname, "..");

// pega o nome da pasta raiz (nome do projeto)
const projectName = basename(projectPath);

// gera o arquivo dentro de tools com o nome do projeto
const outputFile = join(__dirname, `${projectName}.md`);

const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".env", ".css"];
const specialFiles = [
  "Dockerfile",
  "Makefile",
  ".eslintrc",
  ".prettierrc",
  "vite.config.ts",
  "vite.config.js",
  "tailwind.config.js",
  "postcss.config.js"
];
const excludeDirs = ["node_modules", ".git", "dist", "build", "generated"];
const excludeFiles = ["package-lock.json"];

if (existsSync(outputFile)) unlinkSync(outputFile);

function formatHeader(fullPath: string): string {
  const rel = relative(projectPath, fullPath);
  return `## ${rel}`;
}

function wrapContent(ext: string, content: string): string {
  if ([".ts", ".tsx", ".js"].includes(ext)) return `\n\`\`\`${ext.replace(".", "")}\n${content}\n\`\`\`\n`;
  if (ext === ".json") return `\n\`\`\`json\n${content}\n\`\`\`\n`;
  if (ext === ".md") return `\n${content}\n`;
  if (ext === ".env") return `\n\`\`\`env\n${content}\n\`\`\`\n`;
  if (specialFiles.includes(ext)) return `\n\`\`\`\n${content}\n\`\`\`\n`;
  return `\n${content}\n`;
}

function walk(dir: string): void {
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) walk(fullPath);
    } else {
      const ext = extname(file) || file;
      if ((extensions.includes(ext) || specialFiles.includes(file)) && !excludeFiles.includes(file)) {
        try {
          const content = readFileSync(fullPath, "utf8");
          appendFileSync(outputFile, `\n${formatHeader(fullPath)}\n`);
          appendFileSync(outputFile, wrapContent(ext, content));
        } catch (err) {
          console.error("⚠️ Erro ao ler arquivo:", fullPath, (err as Error).message);
        }
      }
    }
  }
}

console.log(`🔍 Gerando arquivo ${projectName}.md...`);
walk(projectPath);
console.log(`✅ Arquivo gerado com sucesso em ${outputFile}`);

```

## tools\HelpDesk-API.md


## .env

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/task_manager?schema=public"

JWT_SECRET="r0s3nd0"

APP_API_URL="http://localhost:3333"
```

## package.json

```json
{
  "name": "helpdesk-api",
  "version": "1.0.0",
  "description": "api do sistema HelpDesk",
  "main": "index.js",
  "scripts": {
    "dev": "tsx --watch --env-file .env src/server.ts",
    "generate-md": "node --loader ts-node/esm tools/generate-md.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "author": "Francisco Rosendo",
  "license": "ISC",
  "type": "module",
  "dependencies": {
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.1.1",
    "pg": "^8.20.0",
    "tsconfig-paths": "^4.2.0",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/connect-livereload": "^0.6.3",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/livereload": "^0.9.5",
    "@types/multer": "^2.1.0",
    "@types/node": "^25.9.4",
    "@types/pg": "^8.20.0",
    "livereload": "^0.10.3",
    "prisma": "^7.8.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.21.0",
    "typescript": "^6.0.3"
  }
}

```

## prisma.config.ts

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { env } from "./src/env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env["DATABASE_URL"],
  },
});

```

## src\app.ts

```ts
import express from "express";
import { errorHandling } from "@/middleware/error-handling";
import { routes } from "@/routes";
import uploadConfig from "./configs/upload";
import cors from "cors";
import { prisma } from "./database/prisma";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // ou "*", se quiser liberar tudo
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use("/files", express.static(uploadConfig.UPLOADS_FOLDER));

//rota para verificar se o BD está online
app.get("/health", async (req, res) => {
  try {
    await prisma.$connect(); // garante que a conexão está ativa
    await prisma.$queryRawUnsafe("SELECT 1"); // comando válido no Postgres
    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Erro no health check:", err);
    res.status(500).json({ status: "error", message: "DB indisponível" });
  } finally {
    await prisma.$disconnect(); // opcional, se quiser encerrar após o teste
  }
});

app.use(routes);
app.use(errorHandling);

export { app };

```

## src\configs\auth.ts

```ts
import { env } from "@/env";
import { SignOptions } from "jsonwebtoken";

export interface AuthConfig {
    jwt: {
        secret: string;
        expiresIn: SignOptions["expiresIn"];
    };
}

export const authConfig: AuthConfig = {
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: "1d"
    }
};

```

## src\configs\upload.ts

```ts
import multer from "multer"
import crypto from "node:crypto"
import path from "node:path"

const TMP_FOLDER = path.resolve(__dirname, "..", "..", "tmp")
const UPLOADS_FOLDER = path.resolve(TMP_FOLDER, "uploads")
const MAX_SIZE = 3
const MAX_FILE_SIZE = 1024 * 1024 * MAX_SIZE
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"]

const MULTER = {
    storage: multer.diskStorage({
        destination: TMP_FOLDER,
        filename(request, file, callback) {
            const fileHash = crypto.randomBytes(10).toString("hex")
            const fileName = `${fileHash}-${file.originalname}`

            return callback(null, fileName)
        }
    })
}

export default {
    TMP_FOLDER,
    UPLOADS_FOLDER,
    MULTER,
    MAX_SIZE,
    MAX_FILE_SIZE,
    ACCEPTED_IMAGE_TYPES
}
```

## src\controllers\chamados-controllers.ts

```ts
import { prisma } from "@/database/prisma";
import { NextFunction, Request, Response } from "express";
import { AppError } from "@/utils/AppError";

class ChamadosControllers {
  async index(request: Request, response: Response) {
    const { id, role } = request.user!;

    let where = {};

    switch (role) {
      case "CLIENTE":
        where = {
          clienteId: id,
        };
        break;

      case "TECNICO":
        where = {
          tecnicoId: id,
        };
        break;

      case "ADMIN":
        where = {};
        break;
    }

    const chamados = await prisma.chamado.findMany({
      where,
      include: {
        disponibilidade: true,
        tecnico: true,
        cliente: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    const chamadosFormatados = chamados.map((chamado) => ({
      id: chamado.id,
      title: chamado.title,
      description: chamado.description,
      status: chamado.status,
      createdAt: chamado.createdAt,
      updatedAt: chamado.updatedAt,
      totalPrice: chamado.totalPrice,
      cliente: { id: chamado.cliente.id, name: chamado.cliente.name },
      tecnico: chamado.tecnico
        ? {
            id: chamado.tecnico.id,
            name: chamado.tecnico.name,
            email: chamado.tecnico.email,
          }
        : null,
      services: chamado.services.map((s) => ({
        id: s.service.id,
        nome: s.service.name,
        price: s.service.price,
      })),
    }));

    return response.json(chamadosFormatados);
  }

  async create(request: Request, response: Response) {
    const { services, title, description } = request.body;
    const clienteId = request.user?.id;

    if (!clienteId) {
      throw new AppError("Cliente não autenticado", 401);
    }

    // 1. Calcular preço total
    const servicos = await prisma.service.findMany({
      where: { id: { in: services } },
    });
    const totalPrice = servicos.reduce((acc, s) => acc + s.price, 0);

    // 2. Escolher admin automaticamente
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    const adminEscolhido = admins[Math.floor(Math.random() * admins.length)];

    if (!adminEscolhido) {
      throw new AppError("Nenhum admin disponível", 400);
    }

    // 3. Escolher técnico automaticamente
    const tecnicos = await prisma.user.findMany({
      where: { role: "TECNICO" },
      include: { chamadosTecnico: true, disponibilidades: true },
    });
    const disponiveis = tecnicos.filter((t) => t.disponibilidades.length > 0);

    const pool: typeof disponiveis = [];
    disponiveis.forEach((t) => {
      const ativos = t.chamadosTecnico.filter(
        (c) => c.status !== "ENCERRADO",
      ).length;
      const peso = Math.max(1, 5 - ativos);
      for (let i = 0; i < peso; i++) pool.push(t);
    });

    if (pool.length === 0) {
      throw new AppError("Nenhum técnico disponível", 400);
    }

    const tecnicoEscolhido = pool[Math.floor(Math.random() * pool.length)];
    const disponibilidadeEscolhida = tecnicoEscolhido.disponibilidades[0];

    // 4. Criar chamado já com os IDs automáticos
    try {
      const chamado = await prisma.chamado.create({
        data: {
          clienteId,
          adminId: adminEscolhido.id,
          tecnicoId: tecnicoEscolhido.id,
          disponibilidadeId: disponibilidadeEscolhida.id,
          status: "ABERTO",
          totalPrice,
          title,
          description,
          services: {
            createMany: {
              data: services.map((serviceId: string) => ({ serviceId })),
            },
          },
        },
      });

      return response.status(201).json({
        id: chamado.id,
        title: chamado.title,
        description: chamado.description,
        status: chamado.status,
        createdAt: chamado.createdAt,
        updatedAt: chamado.updatedAt,
        totalPrice: chamado.totalPrice,
        cliente: {
          id: clienteId,
          name: (await prisma.user.findUnique({ where: { id: clienteId } }))
            ?.name,
        },
        tecnico: { id: tecnicoEscolhido.id, name: tecnicoEscolhido.name },
        services: servicos.map((s) => ({
          id: s.id,
          nome: s.name,
          price: s.price,
        })),
      });
    } catch (error) {
      console.error("Erro ao criar chamado", error);
      return response.status(500).json({ message: "Erro interno", error });
    }
  }

  async update(request: Request, response: Response) {
    const { id } = request.params;
    const chamadoId = Array.isArray(id) ? id[0] : id;
    const {
      tecnicoId,
      disponibilidadeId,
      status,
      services,
      title,
      description,
    } = request.body;

    // 1. Verificar se o chamado existe
    const chamado = await prisma.chamado.findUnique({
      where: { id: chamadoId },
    });
    if (!chamado) {
      throw new AppError("Chamado não encontrado", 404);
    }

    // 2. Validar disponibilidade se informada junto com técnico
    if (tecnicoId && disponibilidadeId) {
      const disponibilidade = await prisma.disponibilidade.findUnique({
        where: { id: disponibilidadeId },
      });

      if (!disponibilidade || disponibilidade.tecnicoId !== tecnicoId) {
        throw new AppError("Disponibilidade inválida para esse técnico", 400);
      }
    }

    // 3. Atualizar serviços e recalcular preço se necessário
    let totalPrice = chamado.totalPrice;
    if (services && Array.isArray(services) && services.length > 0) {
      const servicos = await prisma.service.findMany({
        where: { id: { in: services } },
      });
      totalPrice = servicos.reduce((acc, s) => acc + s.price, 0);

      // Remove serviços antigos
      await prisma.chamadoService.deleteMany({ where: { chamadoId } });

      // Adiciona novos serviços
      await prisma.chamadoService.createMany({
        data: services.map((serviceId: string) => ({
          chamadoId,
          serviceId,
        })),
      });
    }

    // 4. Atualizar chamado
    const chamadoAtualizado = await prisma.chamado.update({
      where: { id: chamadoId },
      data: {
        tecnicoId,
        disponibilidadeId,
        status: status ?? chamado.status,
        totalPrice,
        title,
        description,
      },
      include: {
        disponibilidade: true,
        tecnico: true,
        cliente: true,
        services: { include: { service: true } },
      },
    });

    return response.status(200).json(chamadoAtualizado);
  }

  async listByTecnico(
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = request.params;
      const tecnicoId = Array.isArray(id) ? id[0] : id;

      // Verifica se o técnico existe
      const tecnico = await prisma.user.findUnique({
        where: { id: tecnicoId },
      });

      if (!tecnico || tecnico.role !== "TECNICO") {
        throw new AppError("Técnico não encontrado", 404);
      }
      // Busca os chamados atribuídos ao técnico
      const chamados = await prisma.chamado.findMany({
        where: { tecnicoId, status: { not: "ENCERRADO" } },
        include: {
          disponibilidade: true,
          tecnico: true,
          cliente: true,
          services: { include: { service: true } },
        },
      });

      return response.status(200).json(chamados);
    } catch (error) {
      next(error);
    }
  }
}

export { ChamadosControllers };

```

## src\controllers\disponibilidades-controllers.ts

```ts
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
```

## src\controllers\services-controller.ts

```ts
import { prisma } from "@/database/prisma";
import { Request, Response } from "express";
import { AppError } from "@/utils/AppError";

class ServicesController {
  async create(request: Request, response: Response) {
    const { name, price, active } = request.body;
    const adminId = request.user?.id; // pega do usuário logado

    if (!adminId) {
      throw new AppError("Somente admin pode criar serviços", 403);
    }

    const service = await prisma.service.create({
      data: {
        name,
        price,
        active,
        adminId,
      },
    });

    return response.status(201).json(service);
  }

  async index(request: Request, response: Response) {
    const includeInactive = request.query.includeInactive === "true";
    const userRole = request.user?.role; // supondo que você tenha o role no objeto user

    let services;

    if (includeInactive) {
      if (userRole !== "ADMIN") {
        throw new AppError("Somente admin pode ver serviços inativos", 403);
      }
      services = await prisma.service.findMany(); // todos
    } else {
      services = await prisma.service.findMany({
        where: { active: true }, // só ativos
      });
    }

    return response.json(services);
  }

  async update(request: Request, response: Response) {
    const { id } = request.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { name, price, active } = request.body;

    const service = await prisma.service.update({
      where: { id: userId },
      data: { name, price, active },
    });

    return response.json(service);
  }
}

export { ServicesController };

```

## src\controllers\sessions-controller.ts

```ts
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

            return response.json({
                token,
                user: userWithoutPassword
            });

        } catch (error) {
            next(error)
        }
    }
}
export { SessionsController }
```

## src\controllers\user-avatar-controller.ts

```ts
import { NextFunction, Request, Response } from "express";
import { DiskStorage } from "@/providers/disk-storage";
import { prisma } from "@/database/prisma";
import path from "path";
import uploadConfig from "@/configs/upload";

class UserAvatarController {
  async index(request: Request, response: Response, next: NextFunction) {
    try {
      if (!request.user) {
        return response.status(401).json({ error: "Usuário não autenticado" });
      }

      const userId = request.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      if (!user || !user.avatarUrl) {
        return response.status(404).json({ error: "Avatar não encontrado" });
      }

      // Caminho completo do arquivo
      const filePath = path.resolve(
        uploadConfig.UPLOADS_FOLDER,
        user.avatarUrl,
      );

      // Envia o arquivo diretamente
      return response.sendFile(filePath);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
  async update(request: Request, response: Response, next: NextFunction) {
    try {
      const diskStorage = new DiskStorage();

      if (!request.user) {
        return response.status(401).json({ error: "Usuário não autenticado" });
      }
      const userId = request.user.id; // vem do middleware de autenticação

      if (!request.file) {
        return response.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      //Busca o arquivo antigo antes de substituir
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          avatarUrl: true,
        },
      });
      // Salva o novo arquivo
      const filename = await diskStorage.saveFile(request.file.filename);

      // Atualiza o banco com novo avatar
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: filename },
      });

      // Deleta o avatar antigo
      if (user?.avatarUrl) {
        await diskStorage.deleteFile(user.avatarUrl, "upload");
      }

      return response.status(200).json({ avatarUrl: filename });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
  async delete(request: Request, response: Response, next: NextFunction) {
    try {
      const diskStorage = new DiskStorage();

      if (!request.user) {
        return response.status(401).json({
          error: "Usuário não autenticado",
        });
      }

      const userId = request.user.id;

      // Busca avatar atual
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          avatarUrl: true,
        },
      });

      if (!user?.avatarUrl) {
        return response.status(404).json({
          error: "Usuário não possui avatar",
        });
      }

      // Remove arquivo físico
      await diskStorage.deleteFile(user.avatarUrl, "upload");

      // Remove referência no banco
      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          avatarUrl: null,
        },
      });

      return response.status(200).json(updatedUser);
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
}

export { UserAvatarController };

```

## src\controllers\users-controllers.ts

```ts
import { authConfig } from "@/configs/auth";
import { prisma } from "@/database/prisma";
import { AppError } from "@/utils/AppError";
import { hash } from "bcrypt";
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

    const { password, ...userWithoutPassword } = user;
    return response.status(200).json(userWithoutPassword);
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

  async listClientes(request: Request, response: Response) {
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

```

## src\database\prisma.ts

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/client';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? [] : ["query"],
});
```

## src\env.ts

```ts
import { z } from "zod"

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string(),
    APP_API_URL: z.string().url()
})

export const env = envSchema.parse(process.env)
```

## src\middleware\ensure-authenticated.ts

```ts
import { authConfig } from "@/configs/auth";
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken"

interface TokenPayload {
    role: string,
    sub: string
}

function ensureAuthenticated(
    request: Request, response: Response, next: NextFunction
) {
    try {
        const authHeader = request.headers.authorization
        if (!authHeader) {
            throw new AppError("JWT token is missing", 401)
        }
        const [, token] = authHeader.split(" ")



        if (!token) {
            throw new AppError("JWT token is missing", 401)
        }
        const { role, sub: user_id } = jwt.verify(token, authConfig.jwt.secret) as TokenPayload



        request.user = { id: user_id, role }



        return next()
    } catch (error) {
        throw new AppError("Invalid JWT token", 401)
    }
}
export { ensureAuthenticated }
```

## src\middleware\error-handling.ts

```ts
import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandling(
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (error instanceof AppError) {
        return response.status(error.statusCode).json({
            status: "error",
            message: error.message
        })
    }
    if (error instanceof ZodError) {
        const formattedIssues = error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
        }))
        return response.status(400).json({
            status: "FAIL",
            message: "Validation error",
            issues: formattedIssues
        })
    }
    return response.status(500).json({
        status: "error",
        message: error.message
    })
}
```

## src\middleware\verifyUserAuthorization.ts

```ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";

function verifyUserAuthorization(allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            throw new AppError("Usuário não autenticado", 401);
        }

        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError("Usuário não autorizado", 403);
        }

        return next();
    };
}



export { verifyUserAuthorization }
```

## src\providers\disk-storage.ts

```ts
import uploadConfig from "@/configs/upload";
import fs from "node:fs";
import path from "node:path";

class DiskStorage {
  async saveFile(file: string) {
    const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file);
    const destPath = path.resolve(uploadConfig.UPLOADS_FOLDER, file);
    try {
      await fs.promises.access(tmpPath);
    } catch (error) {
      console.log(error);
      throw new Error(`Arquivo não encontrado: ${tmpPath}`);
    }
    await fs.promises.mkdir(uploadConfig.UPLOADS_FOLDER, { recursive: true });
    await fs.promises.rename(tmpPath, destPath);
    return file;
  }

  async deleteFile(file: string, type: "tmp" | "upload") {
    const folder =
      type === "tmp" ? uploadConfig.TMP_FOLDER : uploadConfig.UPLOADS_FOLDER;

    const filePath = path.resolve(folder, file);

    try {
      await fs.promises.unlink(filePath);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export { DiskStorage };

```

## src\routes\chamados-routes.ts

```ts
import { Router } from "express"
import { ChamadosControllers } from "@/controllers/chamados-controllers"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization"

const chamadosRoutes = Router()
const chamadosControllers = new ChamadosControllers()

// Criar chamado (cliente)
chamadosRoutes.post("/",
    ensureAuthenticated,
    verifyUserAuthorization(["CLIENTE"]),
    chamadosControllers.create
)

// Listar chamados (filtra por role)
chamadosRoutes.get("/",
    ensureAuthenticated,
    chamadosControllers.index
)

// Listar chamados de um tecnico especifico 
chamadosRoutes.get("/tecnico/:id",
    ensureAuthenticated,
    chamadosControllers.listByTecnico
)

// Update chamados - passe o id do chamado
chamadosRoutes.patch("/:id",
    ensureAuthenticated,
    chamadosControllers.update
)

export { chamadosRoutes }

```

## src\routes\disponibilidades-routes.ts

```ts
import { DisponibilidadesController } from "@/controllers/disponibilidades-controllers";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization";
import { Router } from "express";

const disponibilidadesRoutes = Router()
const disponibilidadesControllers = new DisponibilidadesController()

disponibilidadesRoutes.patch("/:tecnicoId",
    ensureAuthenticated,
    verifyUserAuthorization(["ADMIN"]),
    disponibilidadesControllers.update
)

disponibilidadesRoutes.get("/:tecnicoId",
    ensureAuthenticated,
    disponibilidadesControllers.index
)

disponibilidadesRoutes.get("/detalhes/:tecnicoId",
    ensureAuthenticated,
    disponibilidadesControllers.show
)

export { disponibilidadesRoutes }
```

## src\routes\index.ts

```ts
import { Router } from "express";
import { usersRoutes } from "./users-routes";
import { sessionsRoutes } from "./sessions-routes";
import { disponibilidadesRoutes } from "./disponibilidades-routes";
import { servicesRoutes } from "./services-routes";
import { chamadosRoutes } from "./chamados-routes";
import { AppError } from "@/utils/AppError";
import { userAvatarRoutes } from "./user-avatar-routes";


const routes = Router()

routes.get("/test-error", () => {
    throw new AppError("Erro de teste", 400)
})

routes.use("/users", usersRoutes)
routes.use("/user-avatar", userAvatarRoutes)
routes.use("/sessions", sessionsRoutes)
routes.use("/disponibilidades", disponibilidadesRoutes)
routes.use("/services", servicesRoutes)
routes.use("/chamados", chamadosRoutes)


export { routes }
```

## src\routes\services-routes.ts

```ts
import { Router } from "express"
import { ServicesController } from "@/controllers/services-controller"
import { ensureAuthenticated } from "@/middleware/ensure-authenticated"
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization"

const servicesRoutes = Router()
const servicesController = new ServicesController()

// Admin cria e atualiza serviços
servicesRoutes.post("/", ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), servicesController.create)
servicesRoutes.patch("/:id", ensureAuthenticated, verifyUserAuthorization(["ADMIN"]), servicesController.update)

// Qualquer usuário pode listar serviços ativos
servicesRoutes.get("/", ensureAuthenticated, servicesController.index)

export { servicesRoutes }

```

## src\routes\sessions-routes.ts

```ts
import { SessionsController } from "@/controllers/sessions-controller";
import { Router } from "express";

const sessionsRoutes = Router()
const sessionsController = new SessionsController()

sessionsRoutes.post("/", sessionsController.create)

export { sessionsRoutes }
```

## src\routes\user-avatar-routes.ts

```ts
import { Router } from "express";
import multer from "multer";
import uploadConfig from "@/configs/upload";
import { UserAvatarController } from "@/controllers/user-avatar-controller";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";

const userAvatarRoutes = Router();
const userAvatarController = new UserAvatarController();
const upload = multer(uploadConfig.MULTER);

userAvatarRoutes.post(
  "/avatar",
  ensureAuthenticated,
  upload.single("file"),
  userAvatarController.update,
);
userAvatarRoutes.get(
  "/avatar",
  ensureAuthenticated,
  userAvatarController.index,
);

userAvatarRoutes.delete(
  "/avatar",
  ensureAuthenticated,
  userAvatarController.delete,
);

export { userAvatarRoutes };

```

## src\routes\users-routes.ts

```ts
import { Router } from "express";
import { UserController } from "@/controllers/users-controllers";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";
import { verifyUserAuthorization } from "@/middleware/verifyUserAuthorization";
import { asyncHandler } from "@/utils/asyncHandler";
import { prisma } from "@/database/prisma";

const usersRoutes = Router();
const userController = new UserController();

/* -------------------------
   🔹 ROTAS DE LISTAGEM
------------------------- */

// Listar todos os usuários (somente ADMIN)
usersRoutes.get(
  "/",
  asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
      verifyUserAuthorization(["ADMIN"])(req, res, async () => {
        await userController.index(req, res, next);
      });
    });
  }),
);

// Listar todos os administradores
usersRoutes.get("/admins", ensureAuthenticated, userController.listAdmins);

// Listar todos os técnicos
usersRoutes.get("/tecnicos", ensureAuthenticated, userController.listTecnicos);

// Listar todos os clientes
usersRoutes.get("/clientes", ensureAuthenticated, userController.listClientes);

/* -------------------------
   🔹 ROTAS DE CONSULTA INDIVIDUAL
------------------------- */

// Buscar um único usuário
usersRoutes.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, async () => {
      await userController.show(req, res, next);
    });
  }),
);

// Atualizar usuário (Admin pode atualizar qualquer um, Técnico/Cliente só o próprio)
usersRoutes.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    ensureAuthenticated(req, res, async () => {
      await userController.update(req, res);
    });
  }),
);

// Excluir usuário (Admin pode excluir Admin, Técnico ou Cliente)
usersRoutes.delete(
  "/:id",
  asyncHandler(async (req, res, next) => {
    ensureAuthenticated(req, res, () => {
      verifyUserAuthorization(["ADMIN"])(req, res, async () => {
        await userController.delete(req, res, next);
      });
    });
  }),
);

/* -------------------------
   🔹 ROTAS DE CRIAÇÃO
------------------------- */

// Criar usuário (Admin, Técnico ou Cliente)
usersRoutes.post(
  "/",
  asyncHandler(async (req, res, next) => {
    const { role } = req.body;

    // Permite cadastro público de CLIENTE
    if (role === "CLIENTE") {
      return userController.create(req, res, next);
    }

    // Mantém regra para ADMIN e TECNICO
    const adminExists = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!adminExists && role === "ADMIN") {
      return userController.create(req, res, next);
    }

    ensureAuthenticated(req, res, () => {
      verifyUserAuthorization(["ADMIN"])(req, res, async () => {
        await userController.create(req, res, next);
      });
    });
  }),
);

export { usersRoutes };

```

## src\server.ts

```ts
import { app } from "@/app";

const PORT = 3333;

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`)
})
```

## src\types\express.d.ts

```ts
declare namespace Express {
    export interface Request {
        user?: {
            id: string
            role: string
        }
    }
}
```

## src\utils\AppError.ts

```ts
class AppError extends Error {
    public readonly statusCode: number

    constructor(message: string, statusCode: number = 400) {
        super(message)
        this.statusCode = statusCode
        Object.setPrototypeOf(this, AppError.prototype)
    }
}
export { AppError }
```

## src\utils\asyncHandler.ts

```ts
import { Request, Response, NextFunction } from "express"

export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}

```

## tools\generate-md.ts

```ts
import { readdirSync, statSync, readFileSync, appendFileSync, existsSync, unlinkSync } from "fs";
import { join, extname, dirname, resolve, relative, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// raiz do projeto (um nível acima de tools)
const projectPath = resolve(__dirname, "..");

// pega o nome da pasta raiz (nome do projeto)
const projectName = basename(projectPath);

// gera o arquivo dentro de tools com o nome do projeto
const outputFile = join(__dirname, `${projectName}.md`);

const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".env", ".css"];
const specialFiles = [
  "Dockerfile",
  "Makefile",
  ".eslintrc",
  ".prettierrc",
  "vite.config.ts",
  "vite.config.js",
  "tailwind.config.js",
  "postcss.config.js"
];
const excludeDirs = ["node_modules", ".git", "dist", "build", "generated"];
const excludeFiles = ["package-lock.json"];

if (existsSync(outputFile)) unlinkSync(outputFile);

function formatHeader(fullPath: string): string {
  const rel = relative(projectPath, fullPath);
  return `## ${rel}`;
}

function wrapContent(ext: string, content: string): string {
  if ([".ts", ".tsx", ".js"].includes(ext)) return `\n\`\`\`${ext.replace(".", "")}\n${content}\n\`\`\`\n`;
  if (ext === ".json") return `\n\`\`\`json\n${content}\n\`\`\`\n`;
  if (ext === ".md") return `\n${content}\n`;
  if (ext === ".env") return `\n\`\`\`env\n${content}\n\`\`\`\n`;
  if (specialFiles.includes(ext)) return `\n\`\`\`\n${content}\n\`\`\`\n`;
  return `\n${content}\n`;
}

function walk(dir: string): void {
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) walk(fullPath);
    } else {
      const ext = extname(file) || file;
      if ((extensions.includes(ext) || specialFiles.includes(file)) && !excludeFiles.includes(file)) {
        try {
          const content = readFileSync(fullPath, "utf8");
          appendFileSync(outputFile, `\n${formatHeader(fullPath)}\n`);
          appendFileSync(outputFile, wrapContent(ext, content));
        } catch (err) {
          console.error("⚠️ Erro ao ler arquivo:", fullPath, (err as Error).message);
        }
      }
    }
  }
}

console.log(`🔍 Gerando arquivo ${projectName}.md...`);
walk(projectPath);
console.log(`✅ Arquivo gerado com sucesso em ${outputFile}`);

```


## tools\instrucoes.md

📘 Guia de Uso — Script `generate-md.ts`

Este utilitário percorre todo o projeto (backend ou frontend) e gera um arquivo `.md` com o conteúdo dos arquivos, formatado em Markdown e destacado por tipo de código.

---

## 🛠️ Estrutura do Projeto
````
meu-projeto/
├─ backend/
│   ├─ src/
│   └─ tools/
│       └─ generate-md.ts
├─ frontend/
│   ├─ src/
│   └─ tools/
│       └─ generate-md.ts
├─ package.json
└─ tsconfig.json
---
````
## 📂 Script `generate-md.ts`

Coloque este arquivo dentro da pasta `tools` de cada parte (backend e frontend):

```ts
import { readdirSync, statSync, readFileSync, appendFileSync, existsSync, unlinkSync } from "fs";
import { join, extname, dirname, resolve, relative, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// raiz do projeto (um nível acima da pasta tools)
const projectPath = resolve(__dirname, "..");

// nome da pasta raiz (ex: backend ou frontend)
const projectName = basename(projectPath);

// arquivo de saída dentro da pasta tools
const outputFile = join(__dirname, `${projectName}.md`);

const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".env", ".css"];
const specialFiles = [
  "Dockerfile", "Makefile", ".eslintrc", ".prettierrc",
  "vite.config.ts", "vite.config.js", "tailwind.config.js", "postcss.config.js"
];
const excludeDirs = ["node_modules", ".git", "dist", "build", "generated"];
const excludeFiles = ["package-lock.json"];

if (existsSync(outputFile)) unlinkSync(outputFile);

function formatHeader(fullPath: string): string {
  const rel = relative(projectPath, fullPath);
  return `## ${rel}`;
}

function wrapContent(ext: string, content: string): string {
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) return `\n\`\`\`${ext.replace(".", "")}\n${content}\n\`\`\`\n`;
  if (ext === ".json") return `\n\`\`\`json\n${content}\n\`\`\`\n`;
  if (ext === ".md") return `\n${content}\n`;
  if (ext === ".env") return `\n\`\`\`env\n${content}\n\`\`\`\n`;
  if (ext === ".css") return `\n\`\`\`css\n${content}\n\`\`\`\n`;
  if (specialFiles.includes(ext)) return `\n\`\`\`\n${content}\n\`\`\`\n`;
  return `\n${content}\n`;
}

function walk(dir: string): void {
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) walk(fullPath);
    } else {
      const ext = extname(file) || file;
      if ((extensions.includes(ext) || specialFiles.includes(file)) && !excludeFiles.includes(file)) {
        try {
          const content = readFileSync(fullPath, "utf8");
          appendFileSync(outputFile, `\n${formatHeader(fullPath)}\n`);
          appendFileSync(outputFile, wrapContent(ext, content));
        } catch (err) {
          console.error("⚠️ Erro ao ler arquivo:", fullPath, (err as Error).message);
        }
      }
    }
  }
}

console.log(`🔍 Gerando arquivo ${projectName}.md...`);
walk(projectPath);
console.log(`✅ Arquivo gerado com sucesso em ${outputFile}`);
```
⚙️ Configuração do TypeScript
- No tsconfig.json da raiz, adicione:

````
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["src", "tools"]
}
````
📦 Dependências
- Instale:

````
"scripts": {
  "generate-md": "ts-node --esm tools/generate-md.ts"
}

````
🚀 Como Rodar
- No terminal, vá até a pasta desejada e rode:
````
npm run generate-md
````


## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "allowArbitraryExtensions": true,
    "ignoreDeprecations": "6.0",
    "types": ["node"]
  },
  "include": ["src", "generated", "tools", "tools/generate-md.ts"]
}

```
