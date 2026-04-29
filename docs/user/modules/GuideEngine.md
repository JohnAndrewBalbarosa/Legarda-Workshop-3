# Guide Engine (Playwright Integration)

The Guide Engine is responsible for projecting the workshop interface directly onto the AWS Management Console using Playwright.

## Responsibilities
- **Browser Automation:** Launches and manages a Chromium instance for the participant.
- **UI Projection:** Injects a Shadow DOM-based overlay into the AWS page.
- **Live Sync:** Maintains a WebSocket connection to the Presenter server to receive the current step and highlights.
- **Interaction Bridging:** Captures user actions (clicks, completions) and forwards them to the backend.

## Architecture

### The "Relentless Loop"
To ensure the overlay remains visible and accurate despite AWS's complex Single Page Application (SPA) navigation, the engine runs a 1000ms loop:
1. **URL Check:** Detects if the user has navigated to a new AWS service.
2. **State Validation:** Checks if the local state matches the server's broadcast.
3. **Re-render:** Idempotently updates the overlay and highlights if changes are detected.

### Shadow DOM Isolation
The overlay is injected into a `Shadow Root` to prevent:
- AWS global CSS from breaking the workshop UI.
- Workshop styles from accidentally affecting the AWS Console appearance.

## Key Methods (in `aws-guide-playwright.mjs`)

### `renderGuideOverlay(page, state)`
The primary rendering logic.
- **Signature Detection:** Uses a JSON stringify of the current state and URL to decide if a DOM update is necessary.
- **Highlight Injection:** Applies `data-w-hl` attributes to target AWS elements and injects a pulsing animation stylesheet into the head.

### `exposeFunction` Bridges
- `__logClick`: Logs user interactions for behavior analysis.
- `__sendComplete`: Triggered when the user clicks "Done", notifying the Presenter.
- `__toggleMin`: Handles UI state (minimized vs. expanded).

## Usage
The engine is started via:
```bash
node user/aws-guide-playwright.mjs
```
It defaults to connecting to the presenter at `ws://127.0.0.1:5050`.
