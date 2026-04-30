import express from 'express'
import { errorHandling } from '@/middleware/error-handling'

const app = express()

app.use(express.json())
app.use(errorHandling)

export { app }