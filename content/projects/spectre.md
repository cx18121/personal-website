---
name: spectre
tagline: fight anyone from anywhere in real-time
status: live
shipped: 2026-05
stack:
  - rust
  - typescript
  - react
  - mediapipe
  - websockets
  - docker
repo: https://github.com/cx18121/spectre
---

A real-time 1v1 fighting game played with your phone as a motion controller. Two players hold their phones up, the camera tracks punches and kicks via pose estimation, and you can watch your silhouette fight.

![spectre arena](hero)

## why

This was originally built for the spring 2026 Cornell Claude Hackathon. We built this because augmented reality is too expensive for most people to try out, so we wanted to create a similar feeling without all the expensive hardware. The goal was to create a fun game that could help people get out of their seats and do some exercise. Now I'm working on expanding this project with a custom SDK.

## how it works

Each phone runs MediaPipe in the browser to get pose keypoints and sends them over WebSocket to a Rust engine. The engine turns the keypoints into game state (hit detection, HP, round transitions) and sends that to the Arena, a separate page that draws both players as silhouettes. Since it's separate, it can run on a TV or laptop for people to watch.

![round results](ko)

The commentator is Claude doing live play-by-play, voiced by ElevenLabs and triggered on hits and knockouts.

![live commentary](commentary)

## decisions

The first version had a Python server. For v1.0 I rewrote it in Rust because hit detection needed to be deterministic and the Python version had too much latency.

The engine, the phone controller, and the Arena are separate apps that only communicate through a shared set of message types. The engine is Rust and everything else is TypeScript.

