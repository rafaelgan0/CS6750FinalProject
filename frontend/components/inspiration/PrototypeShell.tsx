"use client";

import { useEffect, useMemo, useState } from "react";

import type { RecipeWithSlug } from "@/lib/recipes";
import type { MediaForRecipe } from "@/lib/media";
import ShortsFeedItem from "@/components/inspiration/ShortsFeedItem";
import type { ExperienceLevel, OverlayMode } from "@/components/inspiration/types";
import { OVERLAY2_GROUPS } from "@/components/inspiration/overlay2ChecklistData";
import { SoundProvider } from "@/components/inspiration/SoundContext";

type Card = { recipe: RecipeWithSlug; media: MediaForRecipe };

const DEFAULT_CHECKED_ITEMS: Record<string, boolean> = {
  // Produce
  "Produce:Lemons": true,
  "Produce:Garlic": true,
  "Produce:Parsley": true,
  "Produce:Basil": true,
  "Produce:Ginger": false,
  "Produce:Cilantro": false,
  "Produce:Dill": false,

  // Protein
  "Protein:Chicken Pieces": true,
  "Protein:Chicken Thighs": true,
  "Protein:Chicken Breasts": false,
  "Protein:Eggs": true,
  "Protein:Egg Yolks": false,

  // Dairy
  "Dairy:Butter": true,
  "Dairy:Heavy Cream": true,
  "Dairy:Parmesan": true,
  "Dairy:Mozzarella": true,
  "Dairy:Coconut Milk": false,

  // Pantry
  "Pantry:Olive Oil": true,
  "Pantry:Salt": true,
  "Pantry:Black Pepper": true,
  "Pantry:Flour": true,
  "Pantry:Bread Crumbs": true,
  "Pantry:Tomato Paste": true,
  "Pantry:Chicken Stock": true,
  "Pantry:Canned Tomatoes": true,
  "Pantry:Oregano": true,
  "Pantry:Capers": false,
  "Pantry:Anchovy Fillets": true,
  "Pantry:Cayenne Pepper": true, // substitute for chile flakes
  "Pantry:Red Pepper Flakes": false,
  "Pantry:Fish Sauce": false,
  "Pantry:Pesto": false,
  "Pantry:Jalapeno": false,
  "Pantry:Serrano": false,
  "Pantry:Baking Powder": false,
  "Pantry:Smoked Paprika": false,
  "Pantry:Gnocchi": false,
  "Pantry:Rice": true,
  "Pantry:Spinach": false,

  // Specialty
  "Specialty:Sun-dried Tomatoes": true,
  "Specialty:Pancetta": false,
  "Specialty:Bacon": true, // substitute for pancetta
  "Specialty:Tajin": false,
};

export default function PrototypeShell({ cards }: { cards: Card[] }) {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("overlay1");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    DEFAULT_CHECKED_ITEMS,
  );
  const [timeAvailableMinutes, setTimeAvailableMinutes] = useState<number>(30);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    "intermediate",
  );
  const [selectedModel, setSelectedModel] = useState("deepseek-r1:latest");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models?: string[] }) => {
        const models = data.models ?? [];
        if (models.length > 0) {
          setAvailableModels(models);
          if (!models.includes(selectedModel) && models[0]) {
            setSelectedModel(models[0]);
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedCards = useMemo(() => {
    // Lightweight scoring to order recipes by how likely they fit this moment:
    // - Ingredients (greens > yellows > reds)
    // - Time fit (overflow is worst; near-limit is mediocre)
    // - Difficulty fit (based on the same heuristic as the overlay ring)

    function titleCaseWord(w: string) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w;
    }

    function normalizeIngredientNameLite(raw: string) {
      return raw
        .replace(/\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean)
        .map(titleCaseWord)
        .join(" ");
    }

    const itemKeyByName = new Map<string, string>();
    for (const group of OVERLAY2_GROUPS) {
      for (const item of group.items) {
        itemKeyByName.set(item, `${group.title}:${item}`);
      }
    }

    function isChecklistItemChecked(itemName: string) {
      const key = itemKeyByName.get(itemName);
      return key ? Boolean(checkedItems[key]) : false;
    }

    const substitutionByIngredientName: Record<string, string[]> = {
      // Keep in sync with `ShortsFeedItem` so ordering matches the overlay.
      "Chicken Thighs": ["Chicken Breasts"],
      "Chicken Breasts": ["Chicken Thighs"],
      "Chile Flakes": ["Cayenne Pepper"],
      "Red Pepper Flakes": ["Chile Flakes", "Cayenne Pepper"],
      Pancetta: ["Bacon"],
      "Egg Yolks": ["Eggs"],
      Ginger: ["Garlic"],
      Cilantro: ["Parsley"],
      "Fish Sauce": ["Anchovy Fillets"],
      Pesto: ["Basil"],
      Jalapeno: ["Red Pepper Flakes", "Cayenne Pepper"],
      Serrano: ["Jalapeno", "Red Pepper Flakes", "Cayenne Pepper"],
      "Coconut Milk": ["Heavy Cream"],
      Gnocchi: ["Rice"],
      Dill: ["Parsley"],
      Tajin: ["Cayenne Pepper", "Red Pepper Flakes", "Lemons"],
      "Baking Powder": ["Flour"],
      "Smoked Paprika": ["Oregano"],
    };

    function getIngredientAvailability(displayName: string) {
      const hasExact = isChecklistItemChecked(displayName);
      if (hasExact) return { status: "available" as const };

      const alternatives = substitutionByIngredientName[displayName] ?? [];
      const checkedSubs = alternatives.filter(isChecklistItemChecked);
      if (checkedSubs.length > 0) {
        return { status: "substitution" as const };
      }

      return { status: "missing" as const };
    }

    function estimateDifficultyScore(steps: number, t: number) {
      const timeComponent = Math.min(60, t) * 0.6; // max ~36
      const stepComponent = steps * 5; // 6 steps -> 30
      const base = 10;
      const raw = base + stepComponent + timeComponent;
      return Math.max(0, Math.min(100, Math.round(raw)));
    }

    function difficultyFitTone(score: number) {
      const capacity =
        experienceLevel === "beginner"
          ? 40
          : experienceLevel === "intermediate"
            ? 65
            : 85;
      const delta = score - capacity;
      if (delta <= 0) return "lime";
      if (delta <= 15) return "amber";
      return "rose";
    }

    const capacityMinutes = Math.max(1, timeAvailableMinutes);

    function timeFitTone(recipeMinutes: number) {
      // Prototype intent: no buffer; treat "over time" as the only bad case.
      return recipeMinutes > capacityMinutes ? "rose" : "lime";
    }

    function toneToScore(tone: "lime" | "amber" | "rose") {
      return tone === "lime" ? 1 : tone === "amber" ? 0.6 : 0.2;
    }

    function ingredientScoreForRecipe(recipe: Card["recipe"]) {
      const shorts = recipe.shorts_ingredients ?? [];
      const displayNames =
        shorts.length > 0
          ? shorts.map(normalizeIngredientNameLite)
          : recipe.ingredients.map((i) => normalizeIngredientNameLite(i.item ?? ""));

      let max = 0;
      let score = 0;
      for (const name of displayNames) {
        if (!name) continue;
        max += 2;
        const availability = getIngredientAvailability(name);
        if (availability.status === "available") score += 2;
        else if (availability.status === "substitution") score += 1;
      }
      return max > 0 ? score / max : 0;
    }

    // Sort by "compatibility" in an intuitive priority order:
    // 1) time fit (fits first; overflow last)
    // 2) difficulty fit
    // 3) ingredient availability
    return [...cards].sort((a, b) => {
      const minutesA = a.recipe.total_time_minutes ?? 0;
      const minutesB = b.recipe.total_time_minutes ?? 0;

      const timeScoreA = toneToScore(timeFitTone(minutesA));
      const timeScoreB = toneToScore(timeFitTone(minutesB));
      if (timeScoreB !== timeScoreA) return timeScoreB - timeScoreA;

      const stepsA = a.recipe.steps?.length ?? 0;
      const stepsB = b.recipe.steps?.length ?? 0;
      const diffToneA = difficultyFitTone(
        estimateDifficultyScore(stepsA, minutesA),
      );
      const diffToneB = difficultyFitTone(
        estimateDifficultyScore(stepsB, minutesB),
      );
      const diffScoreA = toneToScore(diffToneA);
      const diffScoreB = toneToScore(diffToneB);
      if (diffScoreB !== diffScoreA) return diffScoreB - diffScoreA;

      const ingA = ingredientScoreForRecipe(a.recipe);
      const ingB = ingredientScoreForRecipe(b.recipe);
      if (ingB !== ingA) return ingB - ingA;

      return a.recipe.slug.localeCompare(b.recipe.slug);
    });
  }, [cards, checkedItems, experienceLevel, timeAvailableMinutes]);

  function toggleChecklistItem(itemKey: string) {
    setCheckedItems((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
  }

  return (
    <SoundProvider initialMuted={true}>
      <div className="flex h-dvh w-full flex-col bg-neutral-950 text-white md:flex-row">
        {/* Column 1: prototype controls + pantry checklist (always on) */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-white/10 p-4 md:h-dvh md:w-80 md:border-b-0 md:border-r lg:w-96 lg:p-6">
          <h2 className="text-lg font-semibold">Prototype Controls</h2>
          <p className="mt-1 text-sm text-white/70">
            Overlay 1 and 2 switch how the feed looks. The checklist below is always
            available so you can track what you have.
          </p>

        <div className="mt-4 flex flex-row gap-2">
          <button
            type="button"
            onClick={() => setOverlayMode("overlay1")}
            className={`flex-1 text-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
              overlayMode === "overlay1"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Overlay 1
          </button>
          <button
            type="button"
            onClick={() => setOverlayMode("overlay2")}
            className={`flex-1 text-center rounded-lg px-3 py-2 text-sm font-semibold transition ${
              overlayMode === "overlay2"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Overlay 2
          </button>
        </div>

        <label className="mt-3 text-xs font-semibold text-white/80">
          LLM Model
          <select
            className="mt-1 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/25"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {availableModels.length > 0 ? (
              availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            ) : (
              <option value={selectedModel}>{selectedModel}</option>
            )}
          </select>
        </label>

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="text-xs font-semibold text-white/80">
            How much time do you have?
            <select
              className="mt-1 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/25"
              value={timeAvailableMinutes}
              onChange={(e) => setTimeAvailableMinutes(Number(e.target.value))}
            >
              {[10, 15, 20, 25, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 text-xs font-semibold text-white/80">
            What is your experience level?
            <select
              className="mt-1 w-full rounded-md bg-black/40 px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/25"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>

          <div className="mt-4 text-xs font-semibold text-white/80">What do you have?</div>

          <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {OVERLAY2_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="text-xs font-semibold uppercase text-white/70">
                  {group.title}
                </div>
                <div className="mt-1 grid grid-cols-1 gap-x-2 gap-y-1 sm:grid-cols-2">
                  {group.items.map((item) => {
                    const itemKey = `${group.title}:${item}`;
                    const checked = Boolean(checkedItems[itemKey]);
                    return (
                      <label
                        key={itemKey}
                        className="inline-flex items-center gap-2 text-xs text-white/95"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChecklistItem(itemKey)}
                          className="h-3.5 w-3.5 accent-white"
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

        {/* Column 2: video feed */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-black">
          <div className="flex h-full min-h-0 w-full flex-1 justify-center">
            <div className="h-dvh w-full max-w-[min(100%,460px)] shrink-0">
              <div className="h-dvh overflow-y-scroll snap-y snap-mandatory">
                {sortedCards.map(({ recipe, media }) => (
                  <ShortsFeedItem
                    key={recipe.slug}
                    recipe={recipe}
                    media={media}
                    overlayMode={overlayMode}
                    checkedItems={checkedItems}
                    timeAvailableMinutes={timeAvailableMinutes}
                    experienceLevel={experienceLevel}
                    selectedModel={selectedModel}
                  />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </SoundProvider>
  );
}

