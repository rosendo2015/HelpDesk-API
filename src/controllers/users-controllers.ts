import { Request, Response } from "express"

class UserController {

    async index(request: Request, response: Response) {
        return response.status(200).json({ message: "List Users..." })
    }
    async create(request: Request, response: Response) {

        return response.status(200).json({ message: "Users created..." })
    }
}
export { UserController }