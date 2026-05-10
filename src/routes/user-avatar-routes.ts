import { Router } from "express";
import multer from "multer";
import uploadConfig from "@/configs/upload";
import { UserAvatarController } from "@/controllers/user-avatar-controller";
import { ensureAuthenticated } from "@/middleware/ensure-authenticated";

const userAvatarRoutes = Router();
const userAvatarController = new UserAvatarController();
const upload = multer(uploadConfig.MULTER);

userAvatarRoutes.post(
    "/avatar",
    ensureAuthenticated,
    upload.single("file"),
    userAvatarController.update
);

export { userAvatarRoutes };
