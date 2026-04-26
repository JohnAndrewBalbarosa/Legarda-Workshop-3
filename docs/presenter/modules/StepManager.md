# StepManager Module

The StepManager module is the presenter's playbook. It keeps the list of all planned steps, knows which UI elements should blink, and helps the server know when to move forward.

## Story
As the workshop unfolds, StepManager keeps track of where everyone is. It knows which step is current, what comes next, and what needs to be highlighted for each task. When everyone is done, it signals the server to advance.

## Main Responsibilities
- Store the list of planned steps
- Track current step and completion
- Provide UI highlight details for each step
- Signal when to move to the next step

---

*StepManager is the presenter's director, making sure the show runs smoothly and on cue.*