// Map view: Leaflet with OpenStreetMap tiles, clustered pins, limited to
// Puerto Rico. Loaded on demand the first time the Map tab opens.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./map.css";

export interface MapPoint {
  lat: number;
  lng: number;
  common: string;
  scientific: string | null;
  date: string | null;
  status: string | null;
  thumb: string;
  // Where this observation's photos sit in its tab's photo list.
  tab: string;
  start: number;
  count: number;
}

// Main island plus Vieques, Culebra and Mona.
const PUERTO_RICO = L.latLngBounds([17.85, -67.95], [18.55, -65.2]);
// Panning limit: extra sea around the island so popups near the coast can
// pan fully into view.
const PAN_LIMIT = L.latLngBounds([17.2, -68.5], [19.2, -64.6]);

const pinIcon = L.divIcon({
  className: "map-pin",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -8],
});

function popupContent(p: MapPoint, onOpen: (p: MapPoint) => void) {
  const el = document.createElement("div");
  el.className = "map-popup-body";

  const img = document.createElement("img");
  img.src = p.thumb;
  img.alt = p.common;
  img.loading = "lazy";

  const name = document.createElement("strong");
  name.className = "map-popup-name";
  name.textContent = p.common;

  el.append(img, name);
  // Taxa without a common name already show the scientific name above.
  if (p.scientific && p.scientific !== p.common) {
    const sci = document.createElement("em");
    sci.className = "map-popup-sci";
    sci.textContent = p.scientific;
    el.append(sci);
  }
  const meta = document.createElement("span");
  meta.className = "map-popup-meta";
  meta.textContent = [p.date, p.status].filter(Boolean).join(" · ");
  el.append(meta);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "map-popup-btn";
  btn.textContent = p.count > 1 ? `View ${p.count} photos` : "View photo";
  btn.addEventListener("click", () => onOpen(p));
  el.append(btn);
  return el;
}

export async function initMap(
  el: HTMLElement,
  points: MapPoint[],
  onOpen: (p: MapPoint) => void,
) {
  // The clustering plugin is a UMD build that extends the global `L`.
  (window as unknown as { L: typeof L }).L = L;
  await import("leaflet.markercluster");

  const map = L.map(el, {
    maxBounds: PAN_LIMIT,
    maxBoundsViscosity: 1,
    // Phones need one more step out to fit the whole island.
    minZoom: el.clientWidth < 600 ? 7 : 8,
    zoomSnap: 0.5,
  });

  // Standard OpenStreetMap tiles (no key needed); map.css darkens them to
  // match the site.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    className: "map-tiles",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    iconCreateFunction: (c) =>
      L.divIcon({
        className: "map-cluster",
        html: `<span>${c.getChildCount()}</span>`,
        iconSize: [38, 38],
      }),
  });

  for (const p of points) {
    L.marker([p.lat, p.lng], { icon: pinIcon, title: p.common, alt: p.common })
      .bindPopup(() => popupContent(p, onOpen), {
        className: "map-popup",
        maxWidth: 220,
        minWidth: 180,
      })
      .addTo(cluster);
  }
  map.addLayer(cluster);

  if (points.length) {
    map.fitBounds(cluster.getBounds().pad(0.2), { maxZoom: 13 });
  } else {
    map.fitBounds(PUERTO_RICO);
  }
  return map;
}
