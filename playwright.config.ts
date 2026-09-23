import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Real users are on iOS Safari (browser and installed PWA), which
    // is WebKit, not Chromium — added after a real, live-reproduced bug
    // (a sticky header's backdrop-filter + semi-transparent background
    // silently failed to obscure scrolled-under content in WebKit only,
    // confirmed identical DOM/CSS/geometry in both engines, only the
    // paint differed) went undetected through this entire project's
    // history because only Chromium was ever tested. Desktop Safari,
    // not a mobile emulation, so it exercises the same desktop-nav
    // assumptions the rest of this suite already makes — what actually
    // matters for this class of bug is the WebKit engine itself (the
    // backdrop-filter bug reproduced identically at 1280px), not this
    // particular viewport size. Mobile-specific coverage is a separate,
    // larger undertaking (most of this suite assumes desktop layout).
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 4173",
    url: "http://localhost:4173/es",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
