import { notFound } from "next/navigation";
import Link from "next/link";

import type { RecipeWithSlug } from "@/lib/recipes";
import { getMediaForRecipe } from "@/lib/media";
import { getRecipeBySlug } from "@/lib/recipes";

function formatIngredient(ing: RecipeWithSlug["ingredients"][number]) {
  const amountPart = ing.amount == null ? "" : `${ing.amount}`;
  const unitPart = ing.unit ?? "";
  const itemPart = ing.item;
  return [amountPart, unitPart, itemPart].filter(Boolean).join(" ");
}

export default async function RecipePage({
  params,
}: {
  params: { slug: string };
}) {
  const recipe = await getRecipeBySlug(params.slug);
  if (!recipe) notFound();

  const media = getMediaForRecipe(recipe);
  if (!media) {
    // Recipe exists, but we don't have mapped media yet.
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-6 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:underline"
        >
          ← Back to Inspiration
        </Link>

        <div className="mt-4 bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-5">
            <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {recipe.title}
            </h1>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              By {recipe.author} · {recipe.total_time_minutes} min
            </div>
          </div>

          <div className="px-5 pb-5">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900">
              {media.videoSrc ? (
                <video
                  src={media.videoSrc}
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full"
                  poster={media.imageSrc}
                />
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-t border-black/5 dark:border-white/10">
            <section className="p-5">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Ingredients
              </h2>
              <ul className="mt-3 space-y-2">
                {recipe.ingredients.map((ing, idx) => (
                  <li key={idx} className="text-sm text-zinc-800 dark:text-zinc-100">
                    {formatIngredient(ing)}
                  </li>
                ))}
              </ul>
            </section>

            <section className="p-5 border-t sm:border-t-0 sm:border-l border-black/5 dark:border-white/10">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Steps
              </h2>
              <ol className="mt-3 space-y-4">
                {recipe.steps
                  .slice()
                  .sort((a, b) => a.step_number - b.step_number)
                  .map((step) => (
                    <li key={step.step_number}>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        Step {step.step_number}
                      </div>
                      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                        {step.text}
                      </div>
                    </li>
                  ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

