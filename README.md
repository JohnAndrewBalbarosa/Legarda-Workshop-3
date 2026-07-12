# Legarda-Workshop-3

## Overview

AI-guided AWS EC2 workshop automation platform with real-time presenter sync and visual overlays

Repository: [JohnAndrewBalbarosa/Legarda-Workshop-3](https://github.com/JohnAndrewBalbarosa/Legarda-Workshop-3)

## Problem and Goal

**Problem.** Hands-on AWS workshops are difficult to synchronize when presenters, participants, browser overlays, and EC2 instructions drift out of step.

**Goal.** Coordinate a guided workshop with presenter-controlled steps, participant views, and browser-based visual assistance.

## System Design

- `presenter/`, `user/`, and `usher/`: role-specific web applications.
- `extension/`: browser extension and overlay integration.
- `interaction-recorder/`: interaction capture for repeatable guidance.
- `start-all.mjs` and root scripts: multi-application startup orchestration.

## Setup and Usage

```bash
npm install
cp .env.example .env
npm start

# Windows helper
./start.ps1
```

## Evaluation Method

- Define the project task and expected behavior.
- Run representative examples or user flows.
- Record correctness, speed, reliability, usability, and failure cases.

## Results

- No validated quantitative results are published yet.
- Current README status: implementation and usage are documented before formal measurement.

## Interpretation

- The project can be described as implemented or in progress, but impact claims should stay limited until measurements are collected.
- Use the evaluation plan below to turn the project into resume-ready, evidence-backed work.

## Limitations

- Results should only be treated as validated when this README includes the dataset, sample size, metric definition, and reproduction steps.
- Any AI-generated, OCR-based, scraped, or heuristic output requires manual review before being used as ground truth.
- Environment-dependent measurements such as latency, memory use, browser behavior, and API reliability should be re-measured on the target machine.

## Recommendations and Future Work

- Add a small benchmark or validation dataset.
- Report sample size, success rate, error rate, and runtime where applicable.
- Add screenshots, logs, or exported reports that support the measured results.

## Documentation Standard

This README follows a technical-project structure: overview, goal, system design, setup, evaluation method, results, interpretation, limitations, and recommendations. Update the Results section whenever new measurements are available so project claims stay evidence-backed.
