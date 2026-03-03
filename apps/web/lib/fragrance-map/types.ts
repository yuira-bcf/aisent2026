export type FlavorCoordinate = {
  x: number;
  y: number;
};

export type ReferenceFragrance = {
  id: string;
  name: string;
  nameJa: string;
  brand: string;
  category: string;
  gender: "women" | "men" | "unisex";
  vector: Record<string, number>;
  position: { x: number; y: number };
};

export type SimilarResult = {
  fragrance: ReferenceFragrance;
  similarity: number;
};

export type MapPosition = {
  x: number;
  y: number;
};
