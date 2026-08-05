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
