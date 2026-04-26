# Workshop Workflow

This document describes the current end-to-end workshop flow supported by the platform in this repository. It replaces the placeholder AWS sign-in notes and focuses on the real experience implemented across the presenter, participant, and usher interfaces.

## Live Capture

This section is being updated from the presenter's real EC2 demo path as it happens.

1. **Open the AWS sign-in page**
   - The presenter is currently on the AWS sign-in link.
   - This is the starting point for the live EC2 workshop walkthrough.
   - Next expected action: choose the correct sign-in path and authenticate into the AWS Console.

2. **Choose root user sign-in**
   - The presenter clicked the option to sign in using the root email.
   - This confirms the demo is proceeding through the root-user authentication path.
   - Next expected action: enter the root email address and continue to the password step.

3. **Arrive at the password screen**
   - The presenter has advanced to the password step of the root-user sign-in flow.
   - The root email has already been accepted and the next action is credential entry.
   - Next expected action: enter the password and complete sign-in.

4. **Complete AWS sign-in**
   - The presenter completed authentication and is now inside the AWS Console.
   - This marks the end of the login portion of the live demo path.
   - Next expected action: navigate from the AWS Console to the EC2 service.

5. **Start navigation to EC2**
   - The presenter is now moving from the AWS Console toward EC2.
   - The simplest path is to use the AWS search bar, type `EC2`, and open the EC2 service page.
   - Next expected action: land on the EC2 dashboard or service home page.

6. **Arrive at the EC2 service page**
   - The presenter has reached EC2 inside the AWS Console.
   - This is the handoff point from general AWS navigation into the actual EC2 demo flow.
   - Next expected action: open the `Launch instances` flow.

7. **Enter the Launch instances flow**
   - From the EC2 page, the presenter is navigating into `Launch instances`.
   - This begins the instance-creation walkthrough that participants will follow during the demo.
   - Next expected action: arrive at the instance configuration form.

8. **Use the cheapest basic launch path**
   - For this workshop, the presenter is keeping the EC2 setup intentionally simple.
   - The guided blinking or highlighted fields should focus on the cheapest, most basic choices rather than advanced options.
   - Priority should be given to the minimum required settings needed to launch a working instance for the demo.

9. **Track live progress by EC2 form section**
   - Each major part of the EC2 launch flow should report how many currently connected users have completed that section.
   - This allows the presenter to see room progress at a finer level than just the overall step.
   - Example sections can include instance naming, AMI selection, instance type, key pair, network settings, and final launch review.

## Experience Overview

The workshop is designed as a synchronized, presenter-led session:

- The presenter runs the local server and controls pacing for the room.
- Participants connect to the presenter and see a guided workspace with step progress, overlay cues, and a help button.
- Ushers connect to the same presenter server and monitor a live help queue.
- Progress, assistance requests, and resolutions are tracked throughout the session.
- When everyone completes the current step, the system can advance automatically to the next one.

The UI has a calm, practical control-room feel:

- Presenter and participant screens use cool blue gradients and clear progress panels.
- The participant experience emphasizes clarity: current step, highlighted actions, and explicit completion buttons.
- The usher interface uses warm orange tones to make support work stand out from the main workshop flow.

## Main Workflow

1. **Presenter starts the workshop server**
   - The presenter launches the server on the local network.
   - The server becomes the source of truth for workshop state, progress, and help activity.
   - The workshop can run on the default LAN address or another configured local IP/port.

2. **Presenter opens the dashboard**
   - The presenter uses the dashboard as the command center.
   - From here they can see the current step, participant progress, open help requests, and the workshop summary tiles.
   - The presenter can move backward or forward through the step list and export a report at the end.

3. **Participants connect to the presenter**
   - Each participant app attempts to connect to the presenter endpoint.
   - Once connected, the participant sees:
     - connection status
     - a step navigator
     - the current guided action area
     - a help button for in-person assistance
   - No sign-in flow is currently required by the app.

4. **Ushers connect to the same workshop**
   - Ushers connect as support staff, not as workshop participants.
   - Their dashboard shows open concerns and participant status, including seat labels and current step titles.

5. **Presenter loads or defines the workshop steps**
   - The system expects a predetermined list of steps.
   - Each step can include:
     - a title
     - a short description
     - one or more actions
     - selectors to highlight on screen
   - This lets the participant view stay tightly aligned with the presenter's pacing.

6. **The current step is broadcast to everyone**
   - The presenter server sends the active step to connected participants and ushers.
   - Participants immediately see the current title, description, and required actions.
   - Highlight selectors can be used to visually pulse or outline the relevant UI on the page.

7. **Participants work through the guided actions**
   - Participants follow the current instruction.
   - For each required action, they can mark completion from the participant workspace.
   - Their progress updates live on the presenter dashboard.

8. **The room stays synchronized**
   - The presenter can manually advance when ready.
   - If all connected participants complete the current required actions, the platform can auto-advance to the next step.
   - This keeps the group moving together without the presenter constantly checking every individual seat.

9. **Help requests flow to the support layer**
   - If a participant is stuck, they press the assistance button.
   - The help request includes the participant identity, seat label, and current step.
   - The presenter sees the request in the dashboard help queue.
   - Ushers see the same request in their live help queue.

10. **Ushers resolve concerns**
    - An usher goes to the participant, helps them in person, and marks the request resolved.
    - The resolution is sent back to the presenter server.
    - The participant's request status updates and the concern is logged for reporting.

11. **Workshop progress is continuously tracked**
    - The system records:
      - participant registration and connection activity
      - current step and completed steps
      - help requests
      - concern resolutions
    - This gives the presenter a live operational view and an end-of-session record.

12. **Presenter exports the final report**
    - At the end of the session, the presenter can export a summary of participation and support activity.
    - The report reflects who connected, how far the room progressed, how many concerns were raised, and how many were resolved.

## Roles In Practice

### Presenter

- Starts and hosts the workshop
- Watches group progress
- Advances or retreats steps
- Monitors open concerns
- Exports the final report

### Participant

- Connects to the presenter
- Follows the current guided step
- Completes required actions
- Requests help if blocked

### Usher

- Watches the live queue
- Finds the participant by seat label
- Resolves concerns after helping in person

## What This Workflow Assumes

- All devices are on the same local network.
- The workshop uses a predefined step list rather than freeform presenter improvisation.
- The product currently does not require authentication or a login gate for presenter, participant, or usher roles.
- AWS-specific click paths can be layered into this structure later by supplying concrete step/action definitions and selectors.

## Recommended Next Layer

The platform workflow is now clear. The next content to define in detail is the workshop-specific step list itself, especially:

- the exact AWS task sequence
- the selectors or UI landmarks to highlight
- the action labels participants should mark complete
- any checkpoints where the presenter should pause before advancing
