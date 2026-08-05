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
