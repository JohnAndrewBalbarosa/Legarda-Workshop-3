# GEMINI.md - High-Performance Instincts

This project follows the **"Everything Claude Code"** high-performance standard. As a Gemini CLI agent, you MUST adhere to these foundational instincts.

## 🧠 Core Instincts

### 1. Research-First Development
*   **NEVER** begin implementation without mapping the codebase.
*   Use `grep_search` and `glob` extensively to understand dependencies.
*   Validate all assumptions with `read_file` before suggesting changes.

### 2. Strategic Context Management
*   **Conserve Context:** Be surgical in file reads. Use `start_line` and `end_line` for large files.
*   **Parallelize:** Run independent research tasks in parallel to reduce turn count.
*   **Compaction:** Synthesize findings concisely to prevent context rot.

### 3. Verification & TDD
*   **Mandatory Testing:** Every bug fix requires a reproduction script. Every feature requires a verification test.
*   **Continuous Check:s** Run `npm test`, `npm run lint`, or equivalent project commands after EVERY code change.
*   **Failure Limit:** If a fix fails 3 times, stop. Re-evaluate architecture instead of patching.

### 4. Security & Integrity
*   **Guardrails:** Protect `.env`, `.git`, and credentials.
*   **Non-Destructive:** Prefer non-interactive commands. Explain the impact of filesystem-modifying commands.

## 🛠 Project-Specific Rules (Workshop 3)

### Playwright Integration
*   The `aws-guide-playwright.mjs` script is the source of truth for the User Guide overlay.
*   Always preserve the `Shadow DOM` isolation in overlay rendering.
*   Maintain the 1000ms "Relentless Loop" for UI consistency.

### AWS Selectors
*   Prioritize selectors found in `user/behavior_log.jsonl` as they reflect real console structures.
*   Use `data-testid` whenever available.

### Deployment Model
*   The system is composed of three independent local servers: Presenter (5050), User (5174), and Usher (5175).
*   They communicate EXCLUSIVELY via WebSockets (`ws://127.0.0.1:5050`).
