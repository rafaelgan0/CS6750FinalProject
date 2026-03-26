"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { RecipeWithSlug } from "@/lib/recipes";
import type { MediaForRecipe } from "@/lib/media";
import IngredientsModal from "./IngredientsModal";
import VideoModal from "./VideoModal";

export default function InspirationCard({
  recipe,
  media,
}: {
  recipe: RecipeWithSlug;
  media: MediaForRecipe;
}) {
  const [videoOpen, setVideoOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);

  const metaLine = useMemo(() => {
    // NYT mobile feed shows “author and restaurant name (if it exists)”.
    // We only have `author` in the local JSON, so we map it to that.
    const mins = recipe.total_time_minutes;
    return {
      byline: recipe.author,
      meta: `${mins} min`,
    };
  }, [recipe.author, recipe.total_time_minutes]);

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[140px_1fr] gap-4 p-4">
        <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.imageSrc} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="absolute inset-0 m-auto h-10 w-10 rounded-full bg-black/60 hover:bg-black/70 text-white flex items-center justify-center"
            aria-label="Play video"
          >
            <span className="ml-1 text-sm">▶</span>
          </button>
        </div>

        <div className="flex flex-col justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-zinc-50 line-clamp-2">
              {recipe.title}
            </h2>
            <div className="text-sm text-zinc-600 dark:text-zinc-300 truncate">
              {`By ${metaLine.byline}`}
            </div>

            <div className="mt-2 flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
              <span className="font-medium">5★</span>
              <span className="text-zinc-500 dark:text-zinc-400">{metaLine.meta}</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <button
              type="button"
              onClick={() => setIngredientsOpen(true)}
              className="rounded-full px-4 py-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              See ingredients
            </button>

            <Link
              href={`/recipe/${recipe.slug}`}
              className="rounded-full px-4 py-2 text-sm font-semibold bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-zinc-50 dark:text-black"
            >
              Go to Recipe
            </Link>
          </div>
        </div>
      </div>

      <IngredientsModal
        open={ingredientsOpen}
        title={recipe.title}
        ingredients={recipe.ingredients}
        onClose={() => setIngredientsOpen(false)}
      />

      <VideoModal
        open={videoOpen}
        title={recipe.title}
        imageSrc={media.imageSrc}
        videoSrc={media.videoSrc}
        onClose={() => setVideoOpen(false)}
      />
    </div>
  );
}

