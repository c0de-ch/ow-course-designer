export interface PublicConfig {
  mapsApiKey: string;
  mapId: string | null;
}

// Build-time values: used in `yarn dev` and when /api/config cannot be reached.
const buildTime: PublicConfig = {
  mapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || null,
};

let loaded: PublicConfig | null = null;
let pending: Promise<PublicConfig> | null = null;

/** Runtime public config from /api/config, fetched once per page load. */
export function getPublicConfig(): Promise<PublicConfig> {
  if (loaded) return Promise.resolve(loaded);
  if (!pending) {
    pending = fetch("/api/config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((cfg: PublicConfig) => ({
        mapsApiKey: cfg.mapsApiKey || buildTime.mapsApiKey,
        mapId: cfg.mapId || buildTime.mapId,
      }))
      .catch(() => buildTime)
      .then((cfg) => (loaded = cfg));
  }
  return pending;
}

/** The config once getPublicConfig() has resolved, else the build-time values. */
export function getLoadedPublicConfig(): PublicConfig {
  return loaded ?? buildTime;
}
