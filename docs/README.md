# docs Directory Structure



**Deployment Model:**
- Only the user and presenter sides are local deployments.
- The usher is not a local deployment; it connects to the presenter server and only receives concerns from users.
- The usher can also send a "concern resolved" signal to the presenter for post-report analysis.
- Each deployment model (user, presenter, usher) is deployed and managed independently, and they communicate strictly via networking (API/WebSocket), never via direct function calls or shared code.


This folder will mirror the codebase structure. Each markdown file will describe the implementation (in pseudocode and technical detail) for its corresponding code file. As the codebase is developed, this folder will be updated to match, serving as a reference for code generation and review.


## Example Structure (to be expanded as code is planned):

- docs/
  - user/
    - frontend/
      - App.md
      - components/
        - Overlay.md
        - StepNavigator.md
        - AssistanceButton.md
        - ...
    - backend/
      - websocket.md
      - ...
  - presenter/
    - server.md
    - Dashboard.md
    - websocket.md
    - progressTracker.md
    - ...
  - usher/
    - UsherDashboard.md
    - websocket.md
    - ...

Each file will contain:
- Purpose and responsibilities
- Pseudocode for main logic
- Data flow and interactions
- Key technical decisions

