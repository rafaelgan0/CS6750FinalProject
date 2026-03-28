"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faChevronDown,
  faChevronUp,
  faCheck,
  faCircleQuestion,
  faComment,
  faRightLeft,
  faShareNodes,
  faVolumeHigh,
  faVolumeXmark,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import type { RecipeWithSlug } from "@/lib/recipes";
import type { MediaForRecipe } from "@/lib/media";
import type { ExperienceLevel, OverlayMode } from "@/components/inspiration/types";
import { OVERLAY2_GROUPS } from "@/components/inspiration/overlay2ChecklistData";
import { useSound } from "@/components/inspiration/SoundContext";
import ChatPanel from "@/components/inspiration/ChatPanel";

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function timeLabel(minutes: number) {
  if (minutes >= 60) {
    const h = Math.round(minutes / 60);
    return `${h}h`;
  }
  return `${minutes}m`;
}

function TimeRing({
  basePct,
  overflowPct,
  baseColorHex,
  overflowColorHex,
  label,
}: {
  basePct: number; // 0..1
  overflowPct: number; // 0..1
  baseColorHex: string;
  overflowColorHex: string;
  label: string;
}) {
  const base = Math.max(0, Math.min(1, basePct));
  const overflow = Math.max(0, Math.min(1, overflowPct));
  const r = 16;
  const c = 2 * Math.PI * r;
  const baseDash = base * c;
  const baseGap = c - baseDash;
  const overflowDash = overflow * c;
  const overflowGap = c - overflowDash;

  return (
    <div
      className="relative h-10 w-10 rounded-full bg-black/45 backdrop-blur"
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="4"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={baseColorHex}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${baseDash} ${baseGap}`}
          transform="rotate(-90 20 20)"
        />
        {overflow > 0 ? (
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={overflowColorHex}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${overflowDash} ${overflowGap}`}
            transform="rotate(-90 20 20)"
          />
        ) : null}
      </svg>
      <div className="absolute inset-[6px] rounded-full bg-black/55 flex items-center justify-center">
        <span className="text-[12px] font-extrabold text-white">{label}</span>
      </div>
    </div>
  );
}

function DifficultyRing({
  score,
  colorHex,
}: {
  score: number;
  colorHex: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const gap = c - dash;

  return (
    <div className="relative h-10 w-10 rounded-full bg-black/45 backdrop-blur" aria-hidden="true">
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="4"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={colorHex}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <div className="absolute inset-[6px] rounded-full bg-black/55 flex items-center justify-center">
        <span className="text-[12px] font-extrabold text-white">{pct}</span>
      </div>
    </div>
  );
}

function formatIngredient(
  ingredient: RecipeWithSlug["ingredients"][number],
): string {
  let s = ingredient.item ?? "";

  // Remove parentheticals and common trailing notes.
  s = s.replace(/\([^)]*\)/g, "");
  s = s.replace(/\bfor serving\b/gi, "");
  s = s.replace(/\bto serve\b/gi, "");

  // Normalize common prep labels to match the overlay checklist names.
  s = s.replace(/\bextra-virgin\b/gi, "");
  s = s.replace(/\bcoarse\b/gi, "");
  s = s.replace(/\bkosher\b/gi, "");
  s = s.replace(/\bfreshly\b/gi, "");

  // Drop common prep/descriptive adjectives to keep it "NYT-short".
  s = s.replace(/\bboneless\b/gi, "");
  s = s.replace(/\bskinless\b/gi, "");
  s = s.replace(/\bdrained\b/gi, "");
  s = s.replace(/\bpatted dry\b/gi, "");
  s = s.replace(/\bfresh\b/gi, "");
  s = s.replace(/\bchopped\b/gi, "");
  s = s.replace(/\bminced\b/gi, "");
  s = s.replace(/\bsmashed\b/gi, "");
  s = s.replace(/\bpeeled\b/gi, "");

  // Clean leftover punctuation/conjunction fragments produced by the stripping above.
  s = s.replace(/,\s*and\s*$/gi, "");
  s = s.replace(/\band\s*$/gi, "");
  s = s.replace(/^\s*and\b/gi, "");
  s = s.replace(/,+/g, ",");
  s = s.replace(/^[,\s]+|[,\s]+$/g, "");

  // If there are comma-separated descriptors, choose the "core noun" part.
  // - "boneless, skinless chicken thighs" -> "chicken thighs" (last part)
  // - "lemon, halved" -> "lemon" (first part; last is prep)
  const commaParts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length > 1) {
    const first = commaParts[0]!;
    const last = commaParts[commaParts.length - 1]!;
    const looksLikePrepOnly =
      /^(halved|quartered|sliced|diced|chopped|minced|peeled|smashed)$/i.test(last) ||
      /^and$/i.test(last);
    s = looksLikePrepOnly ? first : last;
  }

  // Normalize whitespace.
  s = s.replace(/\s+/g, " ").trim();

  // Title-case for display (simple heuristic).
  s = s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return s || "Ingredient";
}

type ParsedOverlayIngredientLine = {
  displayName: string;
  options: string[];
};

function normalizeIngredientName(raw: string): string {
  let s = raw;

  s = s.replace(/\([^)]*\)/g, "");
  s = s.replace(/\bfor serving\b/gi, "");
  s = s.replace(/\bto serve\b/gi, "");
  s = s.replace(/\bplus more to taste\b/gi, "");
  s = s.replace(/\bto taste\b/gi, "");

  s = s.replace(/\bextra-virgin\b/gi, "");
  s = s.replace(/\bcoarse\b/gi, "");
  s = s.replace(/\bkosher\b/gi, "");
  s = s.replace(/\bfreshly\b/gi, "");
  s = s.replace(/\bthinly\b/gi, "");

  s = s.replace(/\bboneless\b/gi, "");
  s = s.replace(/\bskinless\b/gi, "");
  s = s.replace(/\bdrained\b/gi, "");
  s = s.replace(/\bpatted dry\b/gi, "");
  s = s.replace(/\bfresh\b/gi, "");
  s = s.replace(/\bchopped\b/gi, "");
  s = s.replace(/\bminced\b/gi, "");
  s = s.replace(/\bsmashed\b/gi, "");
  s = s.replace(/\bpeeled\b/gi, "");
  s = s.replace(/\bsliced\b/gi, "");
  s = s.replace(/\bcubed\b/gi, "");

  s = s.replace(/\bfillets?\b/gi, "fillets");
  s = s.replace(/\bwedge(s)?\b/gi, "");

  s = s.replace(/,\s*and\s*$/gi, "");
  s = s.replace(/\band\s*$/gi, "");
  s = s.replace(/^\s*and\b/gi, "");
  s = s.replace(/,+/g, ",");
  s = s.replace(/^[,\s]+|[,\s]+$/g, "");

  const commaParts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length > 1 && !/\bor\b/i.test(s)) {
    const first = commaParts[0]!;
    const last = commaParts[commaParts.length - 1]!;
    const looksLikePrepOnly =
      /^(halved|quartered|sliced|diced|chopped|minced|peeled|smashed)$/i.test(last) ||
      /^and$/i.test(last);
    s = looksLikePrepOnly ? first : last;
  }

  s = s.replace(/\s+/g, " ").trim();
  s = s
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return s || "Ingredient";
}

function parseOverlayIngredientLines(
  ingredient: RecipeWithSlug["ingredients"][number],
): ParsedOverlayIngredientLine[] {
  let raw = ingredient.item ?? "";

  raw = raw.replace(/\([^)]*\)/g, "");
  raw = raw.replace(/,\s*plus more to taste\b/gi, "");
  raw = raw.replace(/,\s*for serving\b/gi, "");
  raw = raw.replace(/,\s*to taste\b/gi, "");
  raw = raw.replace(/\bfor serving\b/gi, "");
  raw = raw.replace(/\bto serve\b/gi, "");
  raw = raw.replace(/\s+/g, " ").trim();

  // "A and B" should show as separate lines.
  const andParts = raw
    .split(/\s+\band\b\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const parsed: ParsedOverlayIngredientLine[] = [];
  for (const part of andParts) {
    // For multi-option ingredient text, show first option but evaluate all.
    // Supports forms like "salt or pepper" and "avocado, grapeseed or canola oil".
    const hasOr = /\bor\b/i.test(part);
    const optionCandidates = hasOr
      ? part.split(/\s*,\s*|\s+\bor\b\s+/i)
      : [part];

    const options = optionCandidates
      .map((candidate) => normalizeIngredientName(candidate))
      .filter(Boolean);

    const dedupedOptions = Array.from(new Set(options));
    if (dedupedOptions.length === 0) continue;

    parsed.push({
      displayName: dedupedOptions[0]!,
      options: dedupedOptions,
    });
  }

  return parsed;
}

export default function ShortsFeedItem({
  recipe,
  media,
  overlayMode,
  checkedItems,
  timeAvailableMinutes,
  experienceLevel,
  selectedModel,
  ingredientsOpen: overlay2IngredientsOpen,
  setIngredientsOpen: setOverlay2IngredientsOpen,
}: {
  recipe: RecipeWithSlug;
  media: MediaForRecipe;
  overlayMode: OverlayMode;
  checkedItems: Record<string, boolean>;
  timeAvailableMinutes: number;
  experienceLevel: ExperienceLevel;
  selectedModel: string;
  ingredientsOpen: boolean;
  setIngredientsOpen: (fn: (prev: boolean) => boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mutedRef = useRef(true);
  const isInViewRef = useRef(false);

  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [recipeOverlayOpen, setRecipeOverlayOpen] = useState(false);
  const [recipeIngredientsOpen, setRecipeIngredientsOpen] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUserGestureForSound, setNeedsUserGestureForSound] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [acceptedSubstitutions, setAcceptedSubstitutions] = useState<
    Record<number, boolean>
  >({});

  const { muted, setMuted } = useSound();

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  function pause() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
  }

  useEffect(() => {
    if (!recipeOverlayOpen) return;
    queueMicrotask(() => {
      pause();
      setRecipeIngredientsOpen(true);
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRecipeOverlayOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recipeOverlayOpen]);

  const isOverlay1 = overlayMode === "overlay1";

  useEffect(() => {
    if (chatOpen) {
      queueMicrotask(() => pause());
    } else if (isInViewRef.current) {
      queueMicrotask(() => void tryPlayWithSoundPreference());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    const root = rootRef.current;
    if (!root) return;

    const scrollParent = root.parentElement;
    if (scrollParent) {
      scrollParent.style.overflowY = "hidden";
    }
    return () => {
      if (scrollParent) {
        scrollParent.style.overflowY = "";
      }
    };
  }, [chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Spacebar") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTextInputLike =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        Boolean(target?.isContentEditable);
      if (isTextInputLike) return;

      // Prevent browser "space to scroll" while chat intentionally locks feed scrolling.
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chatOpen]);

  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const videoFrameRef = useRef<HTMLDivElement | null>(null);

  const byline = useMemo(() => `By ${recipe.author}`, [recipe.author]);
  const meta = useMemo(() => `${recipe.total_time_minutes} min`, [recipe.total_time_minutes]);

  function estimateDifficultyScore() {
    const steps = recipe.steps?.length ?? 0;
    const t = recipe.total_time_minutes ?? 0;
    // Prototype heuristic (rebalanced):
    // - steps matter, but shouldn't dominate short recipes
    // - time contributes, but saturates (diminishing returns)
    const timeComponent = Math.min(60, t) * 0.6; // max ~36
    const stepComponent = steps * 5; // 6 steps -> 30
    const base = 10;
    const raw = base + stepComponent + timeComponent;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function difficultyColor(score: number) {
    // Prototype fit model: compare recipe difficulty vs user's experience capacity.
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

  const difficultyScore = estimateDifficultyScore();
  const difficultyTone = difficultyColor(difficultyScore);

  function toneToHex(tone: "lime" | "amber" | "rose") {
    // Keep colors semantically consistent:
    // - lime: green
    // - amber: yellow (not orange)
    // - rose: red
    return tone === "lime"
      ? "#84cc16"
      : tone === "amber"
        ? "#facc15"
        : "#ef4444";
  }

  const recipeMinutes = recipe.total_time_minutes ?? 0;
  const capacityMinutes = Math.max(1, timeAvailableMinutes);
  const overflowMinutes = Math.max(0, recipeMinutes - capacityMinutes);
  const isOverflow = overflowMinutes > 0;

  // Time ring rules:
  // - Green base while recipe fits (<= capacity).
  // - Once overflow happens (> capacity): keep base yellow, and draw overflow arc in red.
  const timeBaseTone: "lime" | "amber" = isOverflow ? "amber" : "lime";
  const timeBaseHex = toneToHex(timeBaseTone);
  const timeOverflowHex = "#ef4444";

  const timeBasePct = isOverflow
    ? 1
    : Math.max(0, Math.min(1, recipeMinutes / capacityMinutes));
  const timeOverflowPct = isOverflow
    ? Math.max(0, Math.min(1, overflowMinutes / capacityMinutes))
    : 0;

  const difficultyColorHex = toneToHex(difficultyTone);

  const itemKeyByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of OVERLAY2_GROUPS) {
      for (const item of group.items) {
        map.set(item, `${group.title}:${item}`);
      }
    }
    return map;
  }, []);

  const substitutionByIngredientName: Record<string, string[]> = {
    // Prototype substitutions tuned to our chicken-heavy video set.
    "Ground Chicken": ["Chicken Thighs", "Chicken Breasts"],
    "Chicken Pieces": ["Chicken Thighs", "Chicken Breasts"],
    "Chicken Thighs": ["Chicken Breasts", "Chicken Pieces"],
    "Chicken Breasts": ["Chicken Thighs"],
    "Chile Flakes": ["Cayenne Pepper"],
    "Red Pepper Flakes": ["Chile Flakes", "Cayenne Pepper"],
    Pancetta: ["Bacon"],
    // Additional substitutions for embedded YouTube recipes.
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

  function isChecklistItemChecked(itemName: string) {
    const key = itemKeyByName.get(itemName);
    return key ? Boolean(checkedItems[key]) : false;
  }

  function getIngredientAvailability(
    displayName: string,
    optionNames: string[],
  ) {
    const hasAnyOption = optionNames.some(isChecklistItemChecked);
    if (hasAnyOption) {
      return { status: "available" as const, substitutes: [] as string[] };
    }
    const alternatives = substitutionByIngredientName[displayName] ?? [];
    const checkedSubs = alternatives.filter(isChecklistItemChecked);
    if (checkedSubs.length > 0) {
      return {
        status: "substitution" as const,
        substitutes: checkedSubs,
      };
    }
    return { status: "missing" as const, substitutes: [] as string[] };
  }

  async function tryPlayWithSoundPreference() {
    const v = videoRef.current;
    if (!v) return;

    if (mutedRef.current) {
      v.muted = true;
      v.volume = 1;
      try {
        await v.play();
        setNeedsUserGestureForSound(false);
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    // User asked for sound-on autoplay. Browsers may block it; we fall back gracefully.
    v.muted = false;
    v.volume = 1;

    try {
      await v.play();
      setNeedsUserGestureForSound(false);
      setIsPlaying(true);
    } catch {
      // Fall back to muted autoplay; prompt user to tap to enable sound.
      v.muted = true;
      setMuted(true);
      try {
        await v.play();
        setNeedsUserGestureForSound(true);
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      // On first user gesture, enable sound if we were forced muted.
      if (needsUserGestureForSound) {
        v.muted = false;
        setMuted(false);
      }
      v.play()
        .then(() => {
          setNeedsUserGestureForSound(false);
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  function toggleMute(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next) setNeedsUserGestureForSound(false);
  }

  async function handleShare(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const url =
      typeof window !== "undefined" ? window.location.href : "";
    const title = recipe.title;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
      } catch {
        // User cancelled or share failed.
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Ignore clipboard errors in prototype.
      }
    }
  }

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            isInViewRef.current = true;
            void tryPlayWithSoundPreference();
          } else {
            isInViewRef.current = false;
            setChatOpen(false);
            pause();
          }
        }
      },
      {
        threshold: 0.75,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const overlay2IngredientLines = useMemo(() => {
    const curated = recipe.shorts_ingredients?.filter(Boolean) ?? [];
    if (curated.length > 0) {
      return curated
        .map((label) => normalizeIngredientName(label))
        .filter(Boolean)
        .map((displayName) => ({ displayName, options: [displayName] }));
    }

    const ingredients = recipe.ingredients ?? [];
    return ingredients.flatMap(parseOverlayIngredientLines);
  }, [recipe.ingredients, recipe.shorts_ingredients]);

  const overlay2IngredientRows = (() => {
    const rows = overlay2IngredientLines.map((line, idx) => {
      const availability = getIngredientAvailability(line.displayName, line.options);
      const order =
        availability.status === "available"
          ? 0
          : availability.status === "substitution"
            ? 1
            : 2;
      return { idx, line, availability, order };
    });

    rows.sort((a, b) => a.order - b.order || a.idx - b.idx);
    return rows;
  })();

  const ingredientStatusSummary = useMemo(() => {
    const total = overlay2IngredientRows.length;
    let available = 0;
    let substitution = 0;
    let missing = 0;

    for (const row of overlay2IngredientRows) {
      const accepted = Boolean(acceptedSubstitutions[row.idx]);
      const status =
        accepted && row.availability.status === "substitution"
          ? "available"
          : row.availability.status;

      if (status === "available") {
        available += 1;
      } else if (status === "substitution") {
        substitution += 1;
      } else {
        missing += 1;
      }
    }

    return { total, available, substitution, missing };
  }, [acceptedSubstitutions, overlay2IngredientRows]);

  const videoContent = (
    <div
      onClick={togglePlay}
      className="absolute inset-0 w-full h-full"
      role="button"
      tabIndex={0}
      aria-label={isPlaying ? "Pause video" : "Play video"}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div
            ref={videoFrameRef}
            className="relative mx-auto bg-black overflow-hidden"
            style={{
              aspectRatio: "9 / 16",
              height: "min(100dvh, calc(100vw * 16 / 9))",
              width: "auto",
              maxWidth: "100vw",
            }}
          >
            <video
              ref={videoRef}
              src={media.videoSrc}
              muted={muted}
              playsInline
              loop
              preload="metadata"
              className="w-full h-full bg-black object-cover"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                const p = v.duration ? v.currentTime / v.duration : 0;
                setProgress(clamp01(p));
              }}
              onVolumeChange={(e) => {
                setMuted(e.currentTarget.muted);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            <div className="absolute right-2 top-2 z-20 flex flex-row gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center justify-center rounded-full bg-black/45 h-10 w-10 text-white backdrop-blur hover:bg-black/60"
                aria-pressed={muted}
                aria-label={muted ? "Unmute video" : "Mute video"}
              >
                <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center rounded-full bg-black/45 h-10 w-10 text-white backdrop-blur hover:bg-black/60"
                aria-label="Share"
              >
                <FontAwesomeIcon icon={faShareNodes} />
              </button>
            </div>

            {/* Overlay 2: time + difficulty indicators under Sound/Share */}
            {!isOverlay1 ? (
              <div className="absolute right-2 top-14 z-20 flex flex-row gap-2 pointer-events-none">
                {/* Time */}
                <TimeRing
                  basePct={timeBasePct}
                  overflowPct={timeOverflowPct}
                  baseColorHex={timeBaseHex}
                  overflowColorHex={timeOverflowHex}
                  label={timeLabel(recipe.total_time_minutes)}
                />

                {/* Difficulty ring */}
                <DifficultyRing score={difficultyScore} colorHex={difficultyColorHex} />
              </div>
            ) : null}

            <div
              className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-300 ${
                isOverlay1 && ingredientsOpen ? "opacity-10" : "opacity-0"
              }`}
            />

            {/* Bottom scrim for title/author readability — both overlays */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0) 80%)",
              }}
            />
            {/* Overlay 2: top-down + left-side scrims — fade with ingredient list */}
            {!isOverlay1 ? (
              <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                  opacity: overlay2IngredientsOpen ? 1 : 0,
                  background: "linear-gradient(180deg, rgba(0,0,0,0.56) 0%, rgba(0,0,0,0.34) 28%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.00) 80%), linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.42) 22%, rgba(0,0,0,0.20) 40%, rgba(0,0,0,0.00) 58%)",
                }}
              />
            ) : null}

            {/* Progress bar (relative to video frame) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div
                className="h-full bg-white"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>

            {/* Overlay 2: ingredient list pinned top-left */}
            {!isOverlay1 ? (
              <div
                className="absolute left-3 top-3 z-30 w-[56%] max-w-[210px] pointer-events-auto transition-all duration-300 rounded-xl"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOverlay2IngredientsOpen((prev) => !prev);
                  }}
                  className={`relative z-10 w-full px-3 py-2 text-left text-base font-extrabold tracking-wide text-white/95 flex flex-col gap-1.5 transition-all duration-300 rounded-lg ${
                    overlay2IngredientsOpen
                      ? "bg-transparent"
                      : "bg-black/50 backdrop-blur"
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>Ingredients</span>
                      {!overlay2IngredientsOpen && ingredientStatusSummary.total > 0 ? (
                        <span className="flex items-center gap-1">
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-black leading-none text-black">
                            {ingredientStatusSummary.available}
                          </span>
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-black leading-none text-black">
                            {ingredientStatusSummary.substitution}
                          </span>
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-black leading-none text-white">
                            {ingredientStatusSummary.missing}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    <FontAwesomeIcon
                      icon={overlay2IngredientsOpen ? faChevronUp : faChevronDown}
                      className="w-2.5 h-2.5 text-white transition-transform duration-300"
                    />
                  </span>
                  {/* Segmented status bar when collapsed */}
                  {!overlay2IngredientsOpen && ingredientStatusSummary.total > 0 ? (
                    <div className="flex w-full h-1 rounded-full overflow-hidden gap-px">
                      {ingredientStatusSummary.available > 0 && (
                        <div
                          className="h-full rounded-full bg-lime-400"
                          style={{
                            flex:
                              ingredientStatusSummary.available /
                              ingredientStatusSummary.total,
                          }}
                        />
                      )}
                      {ingredientStatusSummary.substitution > 0 && (
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{
                            flex:
                              ingredientStatusSummary.substitution /
                              ingredientStatusSummary.total,
                          }}
                        />
                      )}
                      {ingredientStatusSummary.missing > 0 && (
                        <div
                          className="h-full rounded-full bg-rose-400"
                          style={{
                            flex:
                              ingredientStatusSummary.missing /
                              ingredientStatusSummary.total,
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                </button>

                <div
                  className={`relative z-10 overflow-hidden transition-all duration-300 ease-out ${
                    overlay2IngredientsOpen ? "max-h-[70dvh] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <ul className="px-3 pb-3 mt-1 space-y-1">
                    {overlay2IngredientRows.map(({ idx, line, availability }) => {
                      const hasAcceptedSubstitution = Boolean(acceptedSubstitutions[idx]);
                      const effectiveStatus =
                        hasAcceptedSubstitution && availability.status === "substitution"
                          ? "available"
                          : availability.status;
                      const effectiveName =
                        hasAcceptedSubstitution && availability.status === "substitution"
                          ? availability.substitutes[0] ?? line.displayName
                          : line.displayName;

                      const colorClass =
                        effectiveStatus === "available"
                          ? "text-lime-300"
                          : effectiveStatus === "substitution"
                            ? "text-amber-300"
                            : "text-rose-300";

                      const isAcceptedSubstitute =
                        hasAcceptedSubstitution && availability.status === "substitution";
                      const icon = isAcceptedSubstitute
                        ? faRightLeft
                        : effectiveStatus === "available"
                          ? faCheck
                          : effectiveStatus === "substitution"
                            ? faCircleQuestion
                            : faXmark;

                      return (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (availability.status !== "substitution") {
                                return;
                              }
                              setAcceptedSubstitutions((prev) => ({
                                ...prev,
                                [idx]: !Boolean(prev[idx]),
                              }));
                            }}
                            className={`group inline-flex items-center gap-2 text-base font-semibold transition-all duration-300 ${colorClass} ${
                              availability.status === "substitution" &&
                              !hasAcceptedSubstitution
                                ? "cursor-pointer"
                                : ""
                            } w-full min-w-0`}
                          >
                            <FontAwesomeIcon
                              icon={icon}
                              className={`w-3.5 h-3.5 transition-transform duration-300 ${
                                hasAcceptedSubstitution
                                  ? "scale-110"
                                  : availability.status === "substitution"
                                    ? "icon-shake-x"
                                    : ""
                              }`}
                            />
                            <span className="truncate">{effectiveName}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Sliding chat panel (Overlay 2 only) — slides from left */}
            {!isOverlay1 ? (
              <div
                className="absolute inset-0 z-40 transition-transform duration-300 ease-out"
                style={{
                  transform: chatOpen ? "translateX(0)" : "translateX(-100%)",
                  pointerEvents: chatOpen ? "auto" : "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ChatPanel
                  recipe={recipe}
                  selectedModel={selectedModel}
                  checkedItems={checkedItems}
                  timeAvailableMinutes={timeAvailableMinutes}
                  experienceLevel={experienceLevel}
                  substitutions={substitutionByIngredientName}
                  onClose={closeChat}
                />
              </div>
            ) : null}

            {recipeOverlayOpen ? (
              <div
                className="absolute inset-0 z-50 bg-black/70 backdrop-blur pointer-events-auto"
                role="dialog"
                aria-modal="true"
                onClick={(e) => {
                  e.stopPropagation();
                  setRecipeOverlayOpen(false);
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 bottom-0 mx-auto w-full overflow-y-auto bg-black/35"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-10 bg-black/70 backdrop-blur px-4 py-3 border-b border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-extrabold leading-snug line-clamp-2">
                          {recipe.title}
                        </div>
                        <div className="mt-1 text-base text-white/80 truncate">
                          By {recipe.author} · {recipe.total_time_minutes} min
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecipeOverlayOpen(false);
                        }}
                        className="shrink-0 rounded-full px-3 py-1.5 text-base font-semibold bg-white/15 hover:bg-white/25 text-white"
                        aria-label="Close recipe"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-4">
                    <div
                      className={`flex items-center justify-between text-sm font-extrabold tracking-wide text-white/80 px-1 rounded ${
                        recipeIngredientsOpen ? "shadow-md bg-black/30" : "shadow-sm bg-black/25"
                      }`}
                    >
                      <span>Ingredients</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecipeIngredientsOpen((prev) => !prev);
                        }}
                        className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10"
                        aria-label={
                          recipeIngredientsOpen ? "Collapse ingredients" : "Expand ingredients"
                        }
                      >
                        <FontAwesomeIcon
                          icon={recipeIngredientsOpen ? faChevronUp : faChevronDown}
                        />
                      </button>
                    </div>

                    <div
                      className={`transition-all duration-300 overflow-hidden ${
                        recipeIngredientsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <ul className="mt-2 space-y-1 text-base text-white/90">
                        {recipe.ingredients.map((ing, idx) => (
                          <li key={idx}>{formatIngredient(ing)}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 text-sm font-extrabold tracking-wide text-white/80">
                      Steps
                    </div>
                    <ol className="mt-2 space-y-3 text-base text-white/90">
                      {recipe.steps
                        .slice()
                        .sort((a, b) => a.step_number - b.step_number)
                        .map((step) => (
                          <li key={step.step_number}>
                            <div className="font-semibold text-white/95">
                              Step {step.step_number}
                            </div>
                            <div className="mt-1">{step.text}</div>
                          </li>
                        ))}
                    </ol>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Overlay content (relative to video frame) */}
            <div className="absolute inset-x-0 bottom-3 px-4 text-white">
              <div className="max-w-3xl mx-auto">
                {isOverlay1 && !ingredientsOpen ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xl font-semibold leading-snug line-clamp-2">
                          {recipe.title}
                        </div>
                        <div className="mt-1 text-base text-white/80 truncate">{byline}</div>
                        <div className="mt-2 flex items-center gap-3 text-base">
                          <span className="font-semibold">5★</span>
                          <span className="text-white/80">{meta}</span>
                        </div>
                      </div>
                    </div>
                    {needsUserGestureForSound ? (
                      <div className="mt-2 text-sm text-white/85">Tap to enable sound</div>
                    ) : null}
                  </>
                ) : null}
                {!isOverlay1 ? (
                  <div className="mb-2">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div>
                        <div className="text-xl font-semibold leading-snug line-clamp-2">
                          {recipe.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-base text-white/80 truncate">
                          <span className="truncate">{byline}</span>
                          <span className="shrink-0 text-white font-semibold">5★</span>
                        </div>
                        {needsUserGestureForSound ? (
                          <div className="mt-2 text-sm text-white/85">
                            Tap to enable sound
                          </div>
                        ) : null}
                      </div>

                      <div className="pointer-events-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openChat();
                          }}
                          aria-label="Open chat"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
                        >
                          <FontAwesomeIcon icon={faComment} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pause();
                            setRecipeOverlayOpen(true);
                          }}
                          aria-label="Go to Recipe"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
                        >
                          <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {isOverlay1 ? (
                  <div className="relative pointer-events-auto mt-3 flex items-center gap-3">
                    <div
                      className={`absolute left-0 right-0 bottom-full mb-2 px-1 text-base font-semibold text-white/95 transition-all duration-300 ${
                        ingredientsOpen
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-2"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onWheel={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      <div className="mb-1 text-lg font-extrabold tracking-wide text-white">
                        Ingredients
                      </div>
                      <ul className="space-y-1">
                        {recipe.ingredients.map((ingredient, idx) => (
                          <li key={idx}>{formatIngredient(ingredient)}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        // Prevent the underlying button (video toggle) from firing.
                        e.stopPropagation();
                        setIngredientsOpen((prev) => !prev);
                      }}
                      className="rounded-full px-4 py-2 text-base font-semibold bg-white/15 hover:bg-white/25 backdrop-blur"
                    >
                      {ingredientsOpen ? "Hide Ingredients" : "See Ingredients"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pause();
                        setRecipeOverlayOpen(true);
                      }}
                      className="rounded-full px-4 py-2 text-base font-semibold bg-white text-black hover:bg-zinc-100"
                    >
                      Go to Recipe
                    </button>
                  </div>
                ) : (
                  null
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  return (
    <div ref={rootRef} className="relative h-dvh w-full snap-start bg-black">
      {videoContent}
    </div>
  );
}

