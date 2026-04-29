# Workshop Plan & Step Management

The Workshop Plan defines the sequence of instructions, highlights, and phases that guide the participant through the AWS EC2 creation process.

## Data Structure

### Step Definition
Each step in `presenter/modules/WorkshopPlan.js` follows this schema:
- `id`: Unique identifier for the step.
- `phase`: The logical grouping (e.g., Preparation, Authentication, Setup).
- `title`: The short header shown in the participant overlay.
- `description`: Detailed instructions for the participant.
- `highlightSelectors`: A list of CSS selectors for elements that should pulse/blink.

### Workflow Reference
Defines the metadata for the entire session:
- `name`: "AWS EC2 AI-Guided Workshop"
- `overview`: High-level summary of the lab goals.
- `phases`: An array of phase objects with descriptions.

## Workshop Phases

1. **Preparation**: Opening the AWS Home page.
2. **Authentication**: Navigating the root-user sign-in flow.
3. **Navigation**: Using the AWS Global Search to find EC2.
4. **EC2 Setup**: Launching the instance using the cheapest configuration path.

## Logic Flow (`StepManager.js`)
- **Indexing:** Tracks the global progress (0 to N).
- **Auto-Advance:** Optionally advances the room when all connected users mark a step as complete.
- **Snapshots:** Generates per-user views of what is "current" vs "completed".
