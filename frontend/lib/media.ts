import type { RecipeWithSlug } from "./recipes";

export type MediaForRecipe = {
  imageSrc: string;
  videoSrc?: string;
};

// Map recipe slug -> public media filenames (no paths).
// Keep this as a simple registry so adding new videos is just 1 entry.
type LocalMediaEntry = { image: string; video: string };
type MediaEntry = LocalMediaEntry;

const MEDIA_BY_SLUG: Record<string, MediaEntry> = {
  "garlicky-chicken-with-lemon-anchovy-sauce": {
    image: "GarlickyLemonyChickenMelissaClark.png",
    video: "GarlickyLemonyChickenMelissaClark.mp4",
  },
  "cold-noodles-with-zucchini": {
    image: "ColdNoodlesWithZuchinniEricKim.png",
    video: "ColdNoodlesWithZuchinniEricKim.mp4",
  },
  "marry-me-chicken": {
    image: "MarryMeChickenNazDeravian.png",
    video: "MarryMeChickenNazDeravian.mp4",
  },
  "crispy-lemon-chicken-cutlets-with-salmoriglio-sauce": {
    image: "CrispyLemonChickenCutletsAnnaFranceseGass.png",
    video: "CrispyLemonChickenCutletsAnnaFranceseGass.mp4",
  },
  "skillet-chicken-with-tomatoes-pancetta-and-mozzarella": {
    image: "SkilletChickenTomatoesPancettaMozzarellaMelissaClark.png",
    video: "SkilletChickenTomatoesPancettaMozzarellaMelissaClark.mp4",
  },

  // YouTube embeds
  "avgolemono-chicken-soup-with-gnocchi": {
    image: "AvgolemonoChickenSoupWithGnocchiCarolinaGelen.jpg",
    video: "Avgelmeno.mp4",
  },
  "chicken-pesto-meatballs": {
    image: "ChickenPestoMeatballsDanPelosi.jpg",
    video: "ChickenPestoMeatball.mp4",
  },
  "thai-inspired-chicken-meatball-soup": {
    image: "ThaiInspiredChickenMeatballSoupJohnnyMiller.jpg",
    video: "ThaiInspired.mp4",
  },
  "tajin-chicken-wings": {
    image: "TajinChickenWingsNatashaJanardan.jpg",
    video: "TajinChickenWing.mp4",
  },
};

export function getMediaForRecipe(recipe: RecipeWithSlug): MediaForRecipe | null {
  const entry = MEDIA_BY_SLUG[recipe.slug];
  if (!entry) return null;

  const media: MediaForRecipe = {
    imageSrc: `/images/${entry.image}`,
  };

  if ("video" in entry) {
    media.videoSrc = `/videos/${entry.video}`;
  }

  return media;
}

