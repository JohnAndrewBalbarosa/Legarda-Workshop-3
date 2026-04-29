# Proposal Document
## EC2 Guided Learning System
### Developer and Non-Developer Use Case

**Version:** 1.0  
**Prepared by:** Implementation Team

---

## 1. Executive Summary
This proposal defines a formal, unified guide for using the EC2 guided learning website. It is designed for both non-developer participants and technical facilitators.

The system provides:
- Step-by-step EC2 guidance on the AWS Console.
- Real-time progress visibility across users and groups.
- Live assistance routing through the Usher interface.

## 2. Objective
Standardize how participants complete EC2 tasks with minimal confusion while allowing facilitators to monitor pace, assist blocked users, and keep the class synchronized.

## 3. Intended Audience
- **Non-Developer Participants:** follow guided EC2 steps without writing code.
- **Developers/Facilitators:** run the guided flow, monitor progress, and support execution quality.

## 4. System Components
### 4.1 Presenter Website
Control interface used by facilitator.

Primary functions:
- Publish the current step to all participants.
- Move class to next step.
- Monitor completion and lag indicators.
- Detect and review help requests.

### 4.2 User Website
Participant-facing guide overlay on AWS EC2 page.

Primary functions:
- Show plain-language step instruction.
- Highlight exact AWS element to click.
- Show participant progress and group standing.
- Send help request when blocked.

### 4.3 Usher Website
Support interface for assistance handling.

Primary functions:
- Receive queued help requests.
- Identify exact step where user is blocked.
- Resolve concern after direct support.

## 5. UI Design Explanation
### 5.1 Presenter UI
- **Step List Panel:** ordered EC2 workflow steps.
- **Current Step Panel:** active instruction broadcast.
- **Advance Control:** pushes next step to all users.
- **Progress Board:** per-user and per-group completion view.

### 5.2 User UI
- **Instruction Card:** action to perform now.
- **Highlight Marker:** visual target on AWS screen.
- **Progress View:** current step and completion state.
- **Relative Progress View:** whether user/group is behind, aligned, or ahead.
- **Help Action Button:** sends assistance request to usher.

### 5.3 Usher UI
- **Help Queue:** list of active requests.
- **Context Panel:** user identity plus blocked step.
- **Resolution Action:** mark request as assisted/resolved.

## 6. Website Workflow
1. Facilitator starts the session through Presenter website.
2. Participants open User website and connect to session.
3. System publishes the first EC2 step to all users.
4. User website highlights target AWS UI element.
5. Participants complete action and monitor their progress.
6. Participants compare status with class/group progress indicator.
7. If blocked, participant clicks Help button.
8. Usher website receives the request with user and step context.
9. Usher approaches the participant and gives direct assistance.
10. Usher marks concern as resolved in UI.
11. Facilitator observes readiness and advances the next step.
12. Sequence repeats until EC2 flow is complete.

## 7. Usher-to-User Assistance Logic (Non-Technical)
- User clicks Help in their UI.
- Usher UI automatically shows who requested help and on which step.
- Usher can immediately locate and approach the correct participant.
- After assistance, usher marks the request resolved.
- Presenter and class progress remain synchronized.

## 8. Use Cases
### Use Case A: Non-Developer Participant
- Follow the instruction card.
- Click highlighted AWS target.
- Check if pacing is aligned with other groups.
- Request help if uncertain.
- Continue until all EC2 steps are done.

### Use Case B: Developer/Facilitator
- Prepare and validate step sequence.
- Operate presenter controls.
- Monitor lagging users/groups using progress board.
- Coordinate usher response for blocked users.
- Complete synchronized run with minimal delay.

## 9. Operational Success Criteria
- EC2 steps are executed in intended order.
- Users can understand and follow UI guidance without coding.
- Usher requests are routed and resolved quickly.
- Progress board clearly indicates pacing versus other users/groups.
- Majority of participants complete the guided flow.

## 10. Governance Note
This document is the official proposal reference for the EC2 guided workflow context.

---

## Appendix A: Quick Role Matrix
| Role | Main Screen | Core Responsibility |
|---|---|---|
| Participant | User Website | Execute guided EC2 actions |
| Facilitator | Presenter Website | Control flow and pacing |
| Support Staff | Usher Website | Resolve live user blockers |

## Appendix B: Minimal Completion Checklist
- Session started and users connected.
- Step broadcast and highlight visible.
- Progress states updating per user/group.
- Help request path verified (User -> Usher -> Resolved).
- Final EC2 step completed.
