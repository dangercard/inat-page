const API_BASE = "https://api.inaturalist.org/v1";

export type PhotoSize = "square" | "small" | "medium" | "large" | "original";

export interface Photo {
  id: number;
  url: string;
  attribution: string;
  license_code: string | null;
  original_dimensions: { width: number; height: number } | null;
}

export interface Taxon {
  name: string;
  preferred_common_name?: string;
  rank: string;
  iconic_taxon_name?: string;
}

export interface Observation {
  id: number;
  uri: string;
  observed_on: string | null;
  species_guess: string | null;
  place_guess: string | null;
  quality_grade: string;
  taxon: Taxon | null;
  photos: Photo[];
}

interface ApiResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: Observation[];
}

export function photoUrl(photo: Photo, size: PhotoSize): string {
  return photo.url.replace(/square\.(jpe?g|png|gif)$/i, `${size}.$1`);
}

export async function fetchAllObservations(userLogin: string): Promise<Observation[]> {
  const perPage = 200;
  const all: Observation[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}/observations?user_login=${encodeURIComponent(userLogin)}&per_page=${perPage}&page=${page}&order=desc&order_by=observed_on&photos=true`;
    const res = await fetch(url, { headers: { "User-Agent": "bio-page (alex.deloach9@gmail.com)" } });
    if (!res.ok) throw new Error(`iNaturalist API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as ApiResponse;
    all.push(...data.results);
    if (all.length >= data.total_results || data.results.length === 0) break;
    page++;
  }

  return all;
}
