"use client";

import type { RecipeIngredient } from "@/lib/recipes";

function formatIngredient(ing: RecipeIngredient) {
  const amountPart = ing.amount == null ? "" : `${ing.amount}`;
  const unitPart = ing.unit ?? "";
  const itemPart = ing.item;

  // Avoid double spaces / empty parts.
  return [amountPart, unitPart, itemPart].filter(Boolean).join(" ");
}

export default function IngredientsModal({
  open,
  title,
  ingredients,
  onClose,
}: {
  open: boolean;
  title: string;
  ingredients: RecipeIngredient[];
  onClose: () => void;
}) {
  if (!open) return null;

  const formatted = ingredients.map(formatIngredient);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white dark:bg-black rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-4 border-b border-black/10 dark:border-white/10">
          <div className="min-w-0">
            <div className="font-semibold truncate">{title}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              Ingredients
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
        <div className="p-4">
          <ul className="space-y-2">
            {formatted.map((s, idx) => (
              <li key={idx} className="text-sm text-zinc-800 dark:text-zinc-100">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

