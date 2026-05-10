import uploadConfig from "@/configs/upload";
import fs from "node:fs";
import path from "node:path";


class DiskStorage {
    async saveFile(file: string) {
        const tmpPath = path.resolve(uploadConfig.TMP_FOLDER, file)
        const destPath = path.resolve(uploadConfig.UPLOADS_FOLDER, file)
        try {
            await fs.promises.access(tmpPath)
        } catch (error) {
            console.log(error)
            throw new Error(`Arquivo não encontrado: ${tmpPath}`)
        }
        await fs.promises.mkdir(uploadConfig.UPLOADS_FOLDER, { recursive: true })
        await fs.promises.rename(tmpPath, destPath)
        return file
    }

    async deleteFile(file: string, type: "tmp" | "upload") {
        const pathFile = type === "tmp" ? uploadConfig.TMP_FOLDER : uploadConfig.UPLOADS_FOLDER
        const filePath = path.resolve(pathFile, file)
        try {
            await fs.promises.stat(filePath)
        } catch (error) {
            console.log(error)
            throw new Error(`arquivo não encontrado: ${filePath}`)
        }
        await fs.promises.unlink(filePath)
    }
}

export { DiskStorage }