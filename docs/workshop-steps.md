# Workshop Steps

This document captures the practical, repeatable sequence for running a workshop with the current application. It focuses on the live room process rather than a specific AWS lab script, since the repository currently supports guided steps but does not yet ship a finalized AWS step list.

## Live Capture

These steps are being captured from the real EC2 demo as it happens.

1. **Open the AWS sign-in page**
   - Navigate to the AWS sign-in link for the workshop.
   - Pause on the sign-in screen before entering credentials.
   - Next expected action: sign in to the AWS Console.

2. **Choose root user sign-in**
   - Click the option to sign in using the root email.
   - Confirm you are following the root-user sign-in path before entering credentials.
   - Next expected action: provide the root email address and continue.

3. **Reach the password step**
   - Continue from the root email prompt until the password screen appears.
   - Confirm the sign-in flow has advanced to password entry.
   - Next expected action: enter the password and sign in.

4. **Finish signing in to AWS Console**
   - Enter the password and complete the sign-in flow.
   - Wait until the AWS Console finishes loading.
   - Next expected action: navigate to the EC2 service.

5. **Open EC2 from the AWS Console**
   - Use the AWS search bar or service navigation to find `EC2`.
   - Select the EC2 service from the results.
   - Next expected action: arrive at the EC2 dashboard.

6. **Arrive at the EC2 page**
   - Wait for the EC2 service page or dashboard to load completely.
   - Confirm you are inside the EC2 area of the AWS Console before continuing.
   - Next expected action: start the instance launch flow.

7. **Open `Launch instances`**
   - Click the `Launch instances` button or entry point from the EC2 page.
   - Confirm that the instance creation workflow begins.
   - Next expected action: review and fill in the instance settings form.

8. **Follow the cheapest basic configuration path**
   - On the `Launch instances` page, focus only on the simplest low-cost options needed to complete the workshop.
   - The blinking guidance should emphasize the basic required selections and avoid advanced settings unless they are necessary.
   - Keep the launch flow lightweight so participants can complete it quickly and consistently.

9. **Report progress for each EC2 form section**
   - As participants move through the launch form, the system should report how many active users have completed each current section.
   - This should help the presenter identify which part of the EC2 flow is slowing the room down.
   - Progress should be visible per form area, not only as one final launched-or-not state.

## Before The Session

1. **Prepare the presenter machine**
   - Make sure the presenter machine is on the same WiFi or LAN as the room.
   - Choose the presenter host and port if the defaults are not suitable.
   - Confirm the workshop step list is ready before participants join.

2. **Start the presenter server**
   - Launch the presenter server locally.
   - Verify that the server is reachable on the intended local network address.
   - Confirm the presenter can access the dashboard and the server health/state endpoints if needed.

3. **Open the presenter dashboard**
   - Check that the dashboard shows:
     - the current workshop step
     - participant counters
     - help request counts
     - report summary tiles
   - If no steps have been loaded yet, expect the dashboard to show a waiting state.

4. **Brief ushers before attendees begin**
   - Tell ushers which dashboard or endpoint they should connect to.
   - Confirm they know how to:
     - read seat labels
     - identify the participant's current step
     - mark a concern as resolved

## Joining The Workshop

5. **Connect usher dashboards**
   - Open the usher interface.
   - Confirm the connection status changes to connected.
   - Verify the live help queue is visible, even if it is still empty.

6. **Connect participant workspaces**
   - Have each participant open the participant app.
   - Confirm each participant connects to the presenter successfully.
   - Check that seat labels or participant identifiers are visible on the presenter side.

7. **Verify the participant view**
   - Each participant should see:
     - a connection badge
     - a step navigator
     - the current workshop instruction area
     - the assistance button
   - If no workshop steps are loaded, the participant view should clearly show a waiting state rather than misleading instructions.

## Running The Live Session

8. **Begin on the first workshop step**
   - Set the current step to the first planned instruction.
   - Confirm the presenter dashboard shows the correct title and description.
   - Confirm participants receive the same step.

9. **Show the guided action for the room**
   - The current step should contain a clear instruction and any relevant highlight selectors.
   - Participants should see the highlighted action card or blinking target area.
   - Use the presenter dashboard to confirm the room is aligned before speaking through the step.

10. **Have participants complete the required actions**
    - Participants follow the on-screen instruction.
    - For each required action, they mark it complete from the participant workspace.
    - The presenter dashboard updates each participant's progress in real time.

11. **Watch for completion status**
    - Use the presenter dashboard to see who is:
      - still working
      - ready for the next step
      - asking for help
    - If everyone connected completes the current step, the system may advance automatically when auto-advance is enabled by the current flow.

12. **Advance to the next step**
    - Move forward when the room is ready.
    - If necessary, use the previous-step control to revisit a completed instruction.
    - Repeat the same cycle for each workshop step:
      - broadcast
      - complete
      - monitor
      - support
      - advance

## Handling Support During The Session

13. **Respond to participant help requests**
    - A participant who is blocked presses the assistance button.
    - The request should appear on both:
      - the presenter dashboard
      - the usher dashboard
    - The request should include the participant's seat label and current step context.

14. **Usher resolves the concern**
    - The usher goes to the participant's seat.
    - After helping, the usher marks the request as resolved in the usher dashboard.
    - The resolution should clear from the open queue and be recorded by the presenter server.

15. **Continue the workshop without losing room awareness**
    - The presenter can keep tracking the overall room while ushers handle individual issues.
    - Open and resolved concerns remain part of the workshop record for later review.

## Closing The Session

16. **Finish the final workshop step**
    - Confirm the current step has been completed by the room.
    - Give participants a final moment for questions or cleanup if needed.

17. **Export the workshop report**
    - Use the presenter controls to export the report after the session.
    - Review totals such as:
      - participants connected
      - participants completed
      - open help requests
      - resolved concerns

18. **Capture follow-up notes**
    - Note any steps where participants consistently slowed down.
    - Note any actions that need clearer labels, better selectors, or stronger overlay guidance.
    - Use those notes to improve the next version of the step list.

## Suggested Structure For Each Future AWS Step

When you are ready to turn this into the actual EC2 workshop script, define each step with:

1. **Step title**
   - A short presenter-friendly title such as `Open EC2 Console`.

2. **Step description**
   - A one- or two-sentence explanation of what the participant is doing and why.

3. **Required actions**
   - Concrete action labels such as `Open Services menu` or `Select EC2`.

4. **Highlight selectors**
   - Selectors or UI landmarks that help the overlay point to the right place.

5. **Advance rule**
   - Whether the step should auto-advance after all required actions are marked complete or wait for the presenter.

## Current Reality Check

These steps now match the application that exists in this repository:

- presenter-led pacing
- participant overlay guidance
- live usher support queue
- real-time progress tracking
- exported reporting

What is still missing is the finalized AWS-specific instruction set. Once you have that step list, this document can be extended with the exact console actions for the live lab.
