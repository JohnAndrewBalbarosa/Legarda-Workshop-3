# Workshop Guide — AWS Chrome Extension

Replaces the Playwright shell (`user/aws-guide-playwright.mjs`) with a real Chrome extension.
Same back-end: connects to the existing presenter WebSocket and uses the same
`workshop_state` / `user.help_request` / `user.signin_choice` / `user.url_report` / `user.ai_request` protocol.

## Why an extension

- Runs in the user's real Chrome — no headed Playwright, no AWS bot-detection risk
- Native `MutationObserver` per-tab — highlights survive AWS Cloudscape SPA re-renders
- A single service-worker WebSocket multiplexes state to every AWS tab the user opens

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest, host permissions for AWS domains |
| `background.js` | Service worker: owns the WebSocket, relays state ↔ tabs |
| `highlight-engine.js` | URL→profile→selectors. Vendored from `user/highlight-engine.mjs` |
| `content.js` | Per-tab UI overlay + drives the highlight engine |
| `popup.html` / `popup.js` | Configure participant ID + presenter WebSocket URL |

## Install (developer mode)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked** → pick the `extension/` folder
4. Click the extension icon → set **Participant ID** and **Presenter WebSocket** (e.g. `ws://192.168.1.244:5050`)
5. Open `https://aws.amazon.com/console/` — the red ripple should highlight the orange "Sign in to the Console" hero button.

## Hero sign-in fix

Old `aws-home` selectors included `text=Sign in` (matched every nav/footer link)
and `a[href*="console.aws.amazon.com"]` (matched everything). The extension's
profile narrows to:

```
a.lb-btn-orange[href*="console.aws.amazon.com"]
a.lb-btn[href*="console.aws.amazon.com/console/home"]
a[data-testid="signin-button"]
header a[href*="console.aws.amazon.com/console/home"]
text=Sign in to the Console
```

These target the actual orange hero CTA only.
