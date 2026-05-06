-- AlterTable
ALTER TABLE "Chamado" ADD COLUMN     "disponibilidadeId" TEXT;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_disponibilidadeId_fkey" FOREIGN KEY ("disponibilidadeId") REFERENCES "Disponibilidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
