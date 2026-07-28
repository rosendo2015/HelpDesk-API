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
