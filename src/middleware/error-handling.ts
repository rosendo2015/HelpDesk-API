import { AppError } from "@/utils/AppError";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandling(
    error: Error,
    request: Request,
    response: Response,
    next: NextFunction
) {
    if (error instanceof AppError) {
        return response.status(error.statusCode).json({ message: error.message })
    }
    if (error instanceof ZodError) {
        return response.status(400).json({ message: "Validation error", issues: error })
    }
    return response.status(500).json({ message: error.message })
}