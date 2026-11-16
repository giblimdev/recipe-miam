-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('GRAM', 'KILOGRAM', 'MILLILITER', 'CENTILITER', 'LITER', 'TEASPOON', 'TABLESPOON', 'CUP', 'PIECE', 'PINCH', 'CLOVE', 'SLICE', 'BUNCH');

-- CreateEnum
CREATE TYPE "IngredientType" AS ENUM ('LEGUME', 'FRUIT', 'VIANDE', 'POISSON', 'FRUITS_DE_MER', 'OEUF', 'PRODUITS_LAITIERS', 'FECULENT', 'LEGUMINEUSE', 'FRUITS_A_COQUE_GRAINES', 'EPICE', 'HERBE', 'MATIERE_GRASSE', 'SUCRE', 'CONDIMENT', 'LIQUIDE', 'AUTRE');

-- CreateEnum
CREATE TYPE "AllergenCode" AS ENUM ('GLUTEN', 'CRUSTACEANS', 'EGGS', 'FISH', 'PEANUTS', 'SOYBEANS', 'MILK', 'NUTS', 'CELERY', 'MUSTARD', 'SESAME', 'SULPHITES', 'LUPIN', 'MOLLUSCS');

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "SlugRecipe" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "prepTime" INTEGER NOT NULL,
    "cookTime" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "calories" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "slugIngredient" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "type" "IngredientType",
    "name" TEXT NOT NULL,
    "image" TEXT,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" "Unit",
    "note" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "image" TEXT,
    "recipeId" TEXT NOT NULL,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slugCategory" TEXT NOT NULL,
    "image" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories_recipes" (
    "recipeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "categories_recipes_pkey" PRIMARY KEY ("recipeId","categoryId")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slugTag" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags_recipes" (
    "recipeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "tags_recipes_pkey" PRIMARY KEY ("recipeId","tagId")
);

-- CreateTable
CREATE TABLE "allergens" (
    "id" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "code" "AllergenCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients_allergens" (
    "ingredientId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,

    CONSTRAINT "ingredients_allergens_pkey" PRIMARY KEY ("ingredientId","allergenId")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipes_SlugRecipe_key" ON "recipes"("SlugRecipe");

-- CreateIndex
CREATE INDEX "recipes_title_idx" ON "recipes"("title");

-- CreateIndex
CREATE INDEX "recipes_displayOrder_idx" ON "recipes"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slugIngredient_key" ON "ingredients"("slugIngredient");

-- CreateIndex
CREATE INDEX "ingredients_displayOrder_idx" ON "ingredients"("displayOrder");

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredientId_idx" ON "recipe_ingredients"("ingredientId");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipeId_position_idx" ON "recipe_ingredients"("recipeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipeId_ingredientId_key" ON "recipe_ingredients"("recipeId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "steps_recipeId_stepNumber_key" ON "steps"("recipeId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slugCategory_key" ON "categories"("slugCategory");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slugTag_key" ON "tags"("slugTag");

-- CreateIndex
CREATE UNIQUE INDEX "allergens_code_key" ON "allergens"("code");

-- CreateIndex
CREATE INDEX "allergens_displayOrder_idx" ON "allergens"("displayOrder");

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories_recipes" ADD CONSTRAINT "categories_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories_recipes" ADD CONSTRAINT "categories_recipes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_recipes" ADD CONSTRAINT "tags_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_recipes" ADD CONSTRAINT "tags_recipes_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients_allergens" ADD CONSTRAINT "ingredients_allergens_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients_allergens" ADD CONSTRAINT "ingredients_allergens_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "allergens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
