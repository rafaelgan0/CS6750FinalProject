import fs from "node:fs/promises";
import path from "node:path";

export type RecipeIngredient = {
  amount: number | null;
  unit: string | null;
  item: string;
};

export type RecipeStep = {
  step_number: number;
  text: string;
};

export type RecipeJson = {
  title: string;
  author: string;
  source: {
    name: string;
    url: string;
  };
  servings: number;
  total_time_minutes: number;
  shorts_ingredients?: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type RecipeWithSlug = RecipeJson & { slug: string };

function getRecipesDir() {
  // Next.js app lives in `frontend/`, while your data files are in the repo root.
  return path.resolve(process.cwd(), "..", "recipes");
}

export async function getAllRecipes(): Promise<RecipeWithSlug[]> {
  const recipesDir = getRecipesDir();
  const entries = await fs.readdir(recipesDir, { withFileTypes: true });
  const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));

  const recipes: RecipeWithSlug[] = [];
  for (const file of jsonFiles) {
    const slug = file.name.replace(/\.json$/i, "");
    const raw = await fs.readFile(path.join(recipesDir, file.name), "utf8");
    const parsed = JSON.parse(raw) as RecipeJson;
    recipes.push({ ...parsed, slug });
  }

  // Stable UI order: alphabetical by slug.
  recipes.sort((a, b) => a.slug.localeCompare(b.slug));
  return recipes;
}

export async function getRecipeBySlug(slug: string): Promise<RecipeWithSlug | null> {
  const recipesDir = getRecipesDir();
  const filename = `${slug}.json`;
  const filePath = path.join(recipesDir, filename);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RecipeJson;
    return { ...parsed, slug };
  } catch {
    return null;
  }
}

