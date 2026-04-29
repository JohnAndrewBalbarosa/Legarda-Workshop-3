# Behavior Tracking & Selector Discovery

Because the AWS Management Console uses dynamic IDs and complex CSS class names, the workshop uses a data-driven approach to maintain accurate selectors.

## The `behavior_log.jsonl` File
This file is an append-only log of every significant interaction performed during a "gold-path" walkthrough.

### Log Schema
```json
{
  "url": "Current AWS URL",
  "tagName": "A, BUTTON, INPUT, etc.",
  "text": "Visible text content",
  "id": "Element ID (if exists)",
  "classes": ["list", "of", "classes"],
  "rect": { "x": 0, "y": 0, "w": 0, "h": 0 },
  "path": "Simplified DOM path"
}
```

## Selector Discovery Workflow

1. **Recording:** Run the `aws-guide-playwright.mjs` script and perform the desired AWS task.
2. **Analysis:** Review the `user/behavior_log.jsonl` to find the most stable attribute for a specific button (e.g., `data-testid` or a unique ID like `#root_account_signin`).
3. **Implementation:** Copy that selector into `presenter/modules/WorkshopPlan.js`.

## Why JSONL?
- **Crash Resistance:** Logs are flushed line-by-line; if Playwright crashes, the history up to that point is preserved.
- **Auditability:** Provides a clear record of what the presenter did during the live capture session.
