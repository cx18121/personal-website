---
name: spectre
tagline: fight anyone from anywhere in real-time
status: live
featured: true
shipped: 2026-05
stack:
  - rust
  - typescript
  - react
  - vite
  - mediapipe
  - websockets
  - docker
  - railway
repo: https://github.com/cx18121/spectre
---

A real-time 1v1 fighting game played with your phone as a motion controller. Two players hold their phones up, the camera tracks punches and kicks via pose estimation, and you can watch your silhouette fight.

![spectre arena](hero)

## why

This was originally built for the spring 2026 Cornell Claude Hackathon. We built this because augmented reality is too expensive for most people to try out, so we wanted to create a similar feeling without all the expensive hardware. The goal was to create a fun game that could help people get out of their seats and do some exercise. Now I'm working on expanding this project with a custom SDK.

## how it works

Each player's phone runs MediaPipe in the browser to extract pose keypoints, streamed to the Rust engine over WebSocket. The engine resolves keypoints into game-state (hit detection, HP, round transitions) and broadcasts state to the spectator-facing Arena view, which renders the two fighters as silhouettes.

![round results](ko)

The Commentator is Claude generating live play-by-play, voiced by ElevenLabs and timed against significant game events.

![claude-generated live commentary](commentary)

## decisions

```decisions
Rust engine over the original Python server | replacing the Python backend at v1.0 gave deterministic hit detection and tighter latency budgets
Explicit message seams between components | engine, mobile controller, arena, shared types; polyglot only works when boundaries are crisp
Spectator-facing render is a separate surface | the Arena is its own app rather than embedded in either phone, so a TV/laptop can host the match
```
