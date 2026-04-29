# Playwright Scripts Guide

This project leverages Playwright not just for testing, but as a core "Self-Hosting" and "Guide Projection" engine.

## Core Scripts

### 1. `presenter/selfhost-playwright.mjs`
- **Purpose:** Opens the local Presenter Dashboard.
- **Behavior:** Boots the server if it's not running and opens the UI in a managed browser.
- **Command:** `npm run start:playwright` (from `presenter/`)

### 2. `user/aws-guide-playwright.mjs`
- **Purpose:** The main "Participant Experience".
- **Behavior:** Opens the real AWS Console and injects the Workshop Overlay. Connects to the Presenter via WebSocket.
- **Command:** `node user/aws-guide-playwright.mjs`

### 3. `user/check-highlight.mjs`
- **Purpose:** Developer utility for verifying selectors.
- **Behavior:** Navigates to a URL and tries to find/blink a specific selector from the workshop plan.

### 4. `scripts/smoke-test.mjs`
- **Purpose:** Headless verification of the full system logic.
- **Behavior:** Spawns a virtual Presenter, User, and Usher, then simulates a help request and step advancement.
- **Command:** `node scripts/smoke-test.mjs`

## Environment Variables
- `PRESENTER_WS`: The WebSocket URL for the presenter (default: `ws://127.0.0.1:5050`).
- `USER_ID`: Unique ID for the participant.
- `PLAYWRIGHT_SKIP_OPEN`: If set to `1`, the script will verify the server but won't open a browser window.
