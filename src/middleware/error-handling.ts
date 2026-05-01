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
        return response.status(error.statusCode).json({
            status: "error",
            message: error.message
        })
    }
    if (error instanceof ZodError) {
        const formattedIssues = error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
        }))
        return response.status(400).json({
            status: "FAIL",
            message: "Validation error",
            issues: formattedIssues
        })
    }
    return response.status(500).json({
        status: "error",
        message: error.message
    })
}