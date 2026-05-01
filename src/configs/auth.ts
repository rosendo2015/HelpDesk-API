import { env } from "@/env"
export interface AuthConfig {
    jwt: {
        secret: string
        expiresIn: string
    }
}
export const authConfig: AuthConfig = {
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: "1d"
    }
}