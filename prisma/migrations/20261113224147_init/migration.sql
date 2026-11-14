-- CreateTable
CREATE TABLE "allergens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT
);

-- CreateTable
CREATE TABLE "ingredients_allergens" (
    "ingredientId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    PRIMARY KEY ("ingredientId", "allergenId"),
    CONSTRAINT "ingredients_allergens_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ingredients_allergens_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergens" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "allergens_code_key" ON "allergens"("code");
