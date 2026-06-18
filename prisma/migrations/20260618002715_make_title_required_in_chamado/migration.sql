/*
  Warnings:

  - Made the column `title` on table `Chamado` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Chamado" ALTER COLUMN "title" SET NOT NULL;
