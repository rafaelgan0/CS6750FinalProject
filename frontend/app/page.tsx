import { getAllRecipes } from "@/lib/recipes";
import type { RecipeWithSlug } from "@/lib/recipes";
import { getMediaForRecipe } from "@/lib/media";
import type { MediaForRecipe } from "@/lib/media";
import PrototypeShell from "@/components/inspiration/PrototypeShell";

type Card = { recipe: RecipeWithSlug; media: MediaForRecipe };

export default async function Home() {
  const recipes = await getAllRecipes();

  // MVP: only show recipes that have a mapped video + image.
  const cards: Card[] = recipes
    .map((recipe): Card | null => {
      const media = getMediaForRecipe(recipe);
      return media ? { recipe, media } : null;
    })
    .filter((card): card is Card => card !== null);

  return (
    <>
      {cards.length === 0 ? (
        <div className="h-dvh flex items-center justify-center px-4 bg-black">
          <div className="max-w-md w-full bg-white/10 text-white rounded-2xl p-4 text-sm">
            No mapped recipes found. Add more `recipes/*.json` and update the mapping in{" "}
            <span className="font-mono">frontend/lib/media.ts</span>.
          </div>
        </div>
      ) : (
        <PrototypeShell cards={cards} />
      )}
    </>
  );
}
