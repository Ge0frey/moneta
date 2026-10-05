import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare Workers build (OpenNext). The app has no ISR or data cache, so it needs no incremental cache
 * (R2/KV): pages render on request and client assets are served from Workers static assets.
 */
export default defineCloudflareConfig();
