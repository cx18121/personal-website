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

Each phone runs MediaPipe in the browser to get pose keypoints and streams them to a Rust engine over WebSocket. The engine turns keypoints into game state (hit detection, HP, rounds) and broadcasts it to the Arena, a separate page that draws both fighters as silhouettes so you can put it on a TV or laptop.

![round results](ko)

The commentator is Claude doing live play-by-play, voiced by ElevenLabs, triggered off big moments like hits and knockouts.

![live commentary](commentary)

## decisions

The first version had a Python server. I rewrote it in Rust for v1.0 because hit detection needed to be deterministic and the Python version couldn't keep latency low enough for a fighting game.

The engine, the phone controller, and the Arena are separate apps that only talk through a shared set of message types. That's what made mixing Rust and TypeScript workable.
