import express from 'express'
import { errorHandling } from '@/middleware/error-handling'
import { routes } from '@/routes'
import uploadConfig from "./configs/upload"

const app = express()

app.use(express.json())
app.use("/files", express.static(uploadConfig.UPLOADS_FOLDER))
app.use(routes)
app.use(errorHandling)

export { app }