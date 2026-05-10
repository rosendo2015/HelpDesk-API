import { NextFunction, Request, Response } from "express";
import { DiskStorage } from "@/providers/disk-storage";
import { prisma } from "@/database/prisma";

class UserAvatarController {
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

            // Salva o arquivo
            const filename = await diskStorage.saveFile(request.file.filename);

            // Atualiza o usuário no banco
            const user = await prisma.user.update({
                where: { id: userId },
                data: { avatarUrl: filename }
            });

            return response.status(200).json({
                message: "Avatar atualizado com sucesso!",
                avatarUrl: user.avatarUrl
            });

        } catch (error) {
            console.log(error)
            next(error)
        }

    }
}

export { UserAvatarController };
