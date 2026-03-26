export type ChecklistGroup = {
  title: string;
  items: string[];
};

export const OVERLAY2_GROUPS: ChecklistGroup[] = [
  {
    title: "Produce",
    items: ["Lemons", "Garlic", "Parsley", "Basil", "Ginger", "Cilantro", "Dill"],
  },
  {
    title: "Protein",
    items: ["Chicken Pieces", "Chicken Thighs", "Chicken Breasts", "Eggs", "Egg Yolks"],
  },
  {
    title: "Dairy",
    items: ["Butter", "Heavy Cream", "Parmesan", "Mozzarella", "Coconut Milk"],
  },
  {
    title: "Pantry",
    items: [
      "Olive Oil",
      "Salt",
      "Black Pepper",
      "Flour",
      "Bread Crumbs",
      "Tomato Paste",
      "Chicken Stock",
      "Canned Tomatoes",
      "Oregano",
      "Capers",
      "Anchovy Fillets",
      "Cayenne Pepper",
      "Red Pepper Flakes",
      "Pesto",
      "Fish Sauce",
      "Jalapeno",
      "Serrano",
      "Baking Powder",
      "Smoked Paprika",
      "Gnocchi",
      "Rice",
      "Spinach",
    ],
  },
  {
    title: "Specialty",
    items: ["Sun-dried Tomatoes", "Pancetta", "Bacon", "Tajin"],
  },
];
