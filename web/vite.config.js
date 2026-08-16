import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./test/setup.js",
    css: true,
    // config.js throws unless these exist, which would stop coverage from
    // instrumenting it and every module that imports it.
    env: {
      VITE_AUTH0_DOMAIN: "tenant.eu.auth0.com",
      VITE_AUTH0_CLIENT_ID: "test-client-id",
      VITE_AUTH0_AUDIENCE: "https://api.pizza42.com",
      VITE_API_BASE_URL: "https://api.pizza42.example",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // `all` keeps unloaded files in the denominator, so mocking a module in a
      // test cannot quietly remove it from the coverage report.
      all: true,
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx"],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 85,
        lines: 90,
      },
    },
  },
});
