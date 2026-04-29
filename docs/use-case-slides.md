---
title: "EC2 Guided Learning System"
subtitle: "Formal Use Case Proposal"
lang: en-US
---

# Executive Summary

- Formal use case guide for EC2 guided website
- Audience: non-developers and developers
- Focus: guided steps, progress tracking, live support

---

# Objective

- Standardize EC2 execution flow
- Reduce participant confusion
- Keep all groups synchronized

---

# System Components

## Presenter Website
- Controls step sequence
- Tracks user and group progress

## User Website
- Shows step instruction
- Highlights AWS target UI
- Shows pacing vs other groups

## Usher Website
- Receives help request queue
- Shows user + blocked step context
- Marks concerns resolved

---

# UI Explanation

## Presenter UI
1. Step list panel
2. Current step panel
3. Advance control
4. Progress board

## User UI
1. Instruction card
2. Highlight marker
3. Progress status
4. Group pacing indicator
5. Help button

## Usher UI
1. Help queue
2. Concern context
3. Resolve action

---

# Website Workflow

1. Presenter starts session
2. Users connect to user website
3. Step is broadcast to all
4. AWS target is highlighted
5. Users perform EC2 action
6. Users see if they are behind/aligned/ahead
7. Blocked user clicks Help
8. Usher receives exact user + step
9. Usher approaches and assists
10. Usher marks resolved
11. Presenter advances next step
12. Repeat until completion

---

# Usher Behavior (User Perspective)

- User clicks Help in UI
- System informs usher where to go
- Usher assists the correct participant
- Request is resolved and tracking updates

---

# Use Cases

## Non-Developer
- Follow instructions and highlights
- Ask help when needed
- Keep pace with class/groups

## Developer/Facilitator
- Run guided sequence
- Monitor pacing and blockers
- Coordinate usher support

---

# Success Criteria

- Steps completed in order
- Progress is visible and reliable
- Help requests are resolved quickly
- Most users complete EC2 flow

---

# End

## EC2 Guided Learning System
Formal Use Case Proposal
