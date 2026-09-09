import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-marker.ts", import.meta.url),
      ),
    },
  },
});
