import express from 'express'
import { errorHandling } from '@/middleware/error-handling'
import { routes } from '@/routes'
import uploadConfig from "./configs/upload"
import cors from "cors"

const app = express()

// Permite requisições do frontend
app.use(cors({
    origin: 'http://localhost:5173', // ou '*' para liberar tudo (não recomendado em produção)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json())
app.use("/files", express.static(uploadConfig.UPLOADS_FOLDER))
app.use(routes)
app.use(errorHandling)

export { app }