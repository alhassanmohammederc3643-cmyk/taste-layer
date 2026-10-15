export type Domain = "place" | "artist" | "movie" | "brand" | "destination" | "book" | "podcast";

export const DOMAIN_URN: Record<Domain, string> = {
  place: "urn:entity:place",
  artist: "urn:entity:artist",
  movie: "urn:entity:movie",
  brand: "urn:entity:brand",
  destination: "urn:entity:destination",
  book: "urn:entity:book",
  podcast: "urn:entity:podcast",
};

export interface Entity {
  id: string;
  name: string;
  type: Domain;
  description?: string;
  tags?: string[];
  score?: number; // affinity, 0..1 when provided
}

export interface Person {
  name: string;
  /** Free-text taste anchors, e.g. "Burna Boy", "Black Panther", "Zara" */
  likes: string[];
}

export interface TasteSource {
  mode: "live" | "sample";
  resolve(name: string, domainHint?: Domain): Promise<Entity | null>;
  recommend(opts: {
    domain: Domain;
    signalEntityIds: string[];
    location?: string;
    take?: number;
    tags?: string[];
  }): Promise<Entity[]>;
}

/** Default tag filters per domain so "place" means somewhere to go out, not a hotel. */
export const DEFAULT_TAGS: Partial<Record<Domain, string[]>> = {
  place: ["urn:tag:genre:place:restaurant"],
};
