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
