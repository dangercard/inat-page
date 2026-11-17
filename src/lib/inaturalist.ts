import { setDefaultResultOrder } from "node:dns";

// api.inaturalist.org advertises an IPv6 (AAAA) address that is unreachable on
// some networks. Node's fetch tries IPv6 first and the TLS handshake gets
// dropped ("Client network socket disconnected before secure TLS connection was
// established"). Preferring IPv4 avoids the dead IPv6 path. Server-side only.
setDefaultResultOrder("ipv4first");

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
  id: number;
  name: string;
  preferred_common_name?: string;
  rank: string;
  rank_level?: number;
  min_species_taxon_id?: number;
  iconic_taxon_name?: string;
  // Establishment flags, relative to the places the observation falls in.
  endemic?: boolean;
  native?: boolean;
  introduced?: boolean;
  threatened?: boolean;
  wikipedia_url?: string | null;
  ancestor_ids?: number[];
  // Total observations of this taxon across iNaturalist.
  observations_count?: number;
}

export interface Annotation {
  controlled_attribute_id: number;
  controlled_value_id: number;
}

export interface Observation {
  id: number;
  uri: string;
  observed_on: string | null;
  // ISO timestamp in the observer's local offset, e.g. 2026-11-17T07:44:03-04:00
  time_observed_at: string | null;
  species_guess: string | null;
  place_guess: string | null;
  // "lat,lng". For obscured observations this is a random point within
  // ~30 km of the real spot, so it isn't useful for mapping.
  location: string | null;
  obscured?: boolean;
  quality_grade: string;
  taxon: Taxon | null;
  photos: Photo[];
  annotations?: Annotation[];
}

export type Establishment = "endemic" | "native" | "introduced";

export function establishment(taxon: Taxon | null): Establishment | null {
  if (!taxon) return null;
  if (taxon.endemic) return "endemic";
  if (taxon.introduced) return "introduced";
  if (taxon.native) return "native";
  return null;
}

interface ControlledTerm {
  id: number;
  label: string;
  values?: { id: number; label: string }[];
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

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr;
}

export async function fetchAllObservations(userLogin: string): Promise<Observation[]> {
  const perPage = 200;
  const all: Observation[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}/observations?user_login=${encodeURIComponent(userLogin)}&per_page=${perPage}&page=${page}&order=desc&order_by=observed_on&photos=true`;
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "bio-page (alex.deloach9@gmail.com)" },
    });
    if (!res.ok) throw new Error(`iNaturalist API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as ApiResponse;
    all.push(...data.results);
    if (all.length >= data.total_results || data.results.length === 0) break;
    page++;
  }

  return all;
}

export interface TaxonSummary {
  id: number;
  name: string;
  preferred_common_name?: string;
}

// Looks up which of the given taxon ids are orders (e.g. Coleoptera), in
// batches small enough to keep the request URL short.
export async function fetchOrders(ids: number[]): Promise<Map<number, TaxonSummary>> {
  const orders = new Map<number, TaxonSummary>();
  for (let i = 0; i < ids.length; i += 150) {
    const batch = ids.slice(i, i + 150).join(",");
    const res = await fetchWithRetry(
      `${API_BASE}/taxa?id=${batch}&rank=order&per_page=200`,
      { headers: { "User-Agent": "bio-page" } },
    );
    if (!res.ok) throw new Error(`iNaturalist API ${res.status}: ${await res.text()}`);
    const { results } = (await res.json()) as { results: TaxonSummary[] };
    for (const t of results) orders.set(t.id, t);
  }
  return orders;
}

// Annotations come back as bare ids; this resolves them to labels such as
// { attribute: "Life Stage", value: "Adult" }.
export async function fetchAnnotationLabeler() {
  const res = await fetchWithRetry(`${API_BASE}/controlled_terms`, {
    headers: { "User-Agent": "bio-page" },
  });
  if (!res.ok) throw new Error(`iNaturalist API ${res.status}: ${await res.text()}`);
  const { results } = (await res.json()) as { results: ControlledTerm[] };

  const attributes = new Map<number, string>();
  const values = new Map<number, string>();
  for (const term of results) {
    attributes.set(term.id, term.label);
    for (const v of term.values ?? []) values.set(v.id, v.label);
  }

  return (a: Annotation) => {
    const attribute = attributes.get(a.controlled_attribute_id);
    const value = values.get(a.controlled_value_id);
    return attribute && value ? { attribute, value } : null;
  };
}
