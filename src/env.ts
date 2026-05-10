import { z } from "zod"

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string(),
    APP_API_URL: z.string().url()
})

export const env = envSchema.parse(process.env)