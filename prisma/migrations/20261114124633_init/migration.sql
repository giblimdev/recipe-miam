/*
  Warnings:

  - You are about to drop the column `SlugRecipe` on the `recipes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slugRecipe]` on the table `recipes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slugRecipe` to the `recipes` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "recipes_SlugRecipe_key";

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "SlugRecipe",
ADD COLUMN     "slugRecipe" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "recipes_slugRecipe_key" ON "recipes"("slugRecipe");
