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

Each phone runs MediaPipe in the browser to get your pose keypoints and sends them over WebSocket to a Rust engine. The engine takes the keypoints and figures out the actual game, so whether a punch landed, HP, when a round ends, and sends that out to the Arena, which is a separate page that draws both players as silhouettes. Since it's separate you can throw it up on a TV or a laptop and everyone can watch.

![round results](ko)

The commentator is Claude doing live play by play. It gets triggered on big moments like hits and knockouts, and ElevenLabs does the voice.

![live commentary](commentary)

## decisions

The first version had a Python server. For v1.0 I rewrote it in Rust because I wanted hit detection to be deterministic and I needed lower latency than I was getting out of Python.

The engine, the phone controller, and the Arena are all separate apps, and the only thing they share is a set of message types. Keeping them apart like that is what let me use Rust for the engine and TypeScript for everything else without it getting messy.

