-- DropForeignKey
ALTER TABLE "Disponibilidade" DROP CONSTRAINT "Disponibilidade_tecnicoId_fkey";

-- AddForeignKey
ALTER TABLE "Disponibilidade" ADD CONSTRAINT "Disponibilidade_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
