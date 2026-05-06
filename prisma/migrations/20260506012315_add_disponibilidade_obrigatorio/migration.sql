/*
  Warnings:

  - Made the column `disponibilidadeId` on table `Chamado` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Chamado" DROP CONSTRAINT "Chamado_disponibilidadeId_fkey";

-- AlterTable
ALTER TABLE "Chamado" ALTER COLUMN "disponibilidadeId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_disponibilidadeId_fkey" FOREIGN KEY ("disponibilidadeId") REFERENCES "Disponibilidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
