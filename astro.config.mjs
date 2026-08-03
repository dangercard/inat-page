// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Cloudflare Pages serves the site at the root of the custom domain, so no
  // `base` is needed. `site` is the canonical URL used for absolute links in
  // any future sitemap/RSS and for `Astro.site`.
  site: "https://elyunquewildlife.com",
});
