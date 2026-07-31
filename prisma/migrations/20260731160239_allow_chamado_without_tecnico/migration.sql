-- DropForeignKey
ALTER TABLE "Chamado" DROP CONSTRAINT "Chamado_disponibilidadeId_fkey";

-- DropForeignKey
ALTER TABLE "Chamado" DROP CONSTRAINT "Chamado_tecnicoId_fkey";

-- AlterTable
ALTER TABLE "Chamado" ALTER COLUMN "tecnicoId" DROP NOT NULL,
ALTER COLUMN "disponibilidadeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_disponibilidadeId_fkey" FOREIGN KEY ("disponibilidadeId") REFERENCES "Disponibilidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
