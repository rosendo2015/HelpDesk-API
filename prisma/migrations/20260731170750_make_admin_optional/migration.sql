-- DropForeignKey
ALTER TABLE "Chamado" DROP CONSTRAINT "Chamado_adminId_fkey";

-- AlterTable
ALTER TABLE "Chamado" ALTER COLUMN "adminId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
