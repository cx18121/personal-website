---
name: podium
tagline: on-device speech practice app
status: live
featured: true
stack:
  - typescript
  - react
  - vite
  - mediapipe
  - whisper.wasm
  - indexeddb
live: https://podium-speech-practice.vercel.app/
repo: https://github.com/cx18121/podium
---

A browser-based presentation practice tool. Records your webcam and microphone inputs, then scores your delivery based on metrics including eye contact, filler words, and pacing, using on-device ML/CV models.

![podium practice](hero)

## why

I wanted to get better at speaking into a camera, since I realized that while speaking, I'd often take long pauses without noticing, talk too fast, break eye contact, and include lots of filler words, so I built this with the goal to help me improve.

## how it works

Before starting, you set up the camera and mic, pick a topic, and choose a duration.

![session setup](setup)

The browser then captures video and audio locally. 6 behavioral dimensions are analyzed in real time via a Web Worker pipeline orchestrating 3 concurrent MediaPipe models for gaze detection, gesture tracking, and expressiveness scoring. Web Speech API and Whisper transcribe the audio to detect pacing, filler words (taking into account word context), and pauses. A weighted scoring engine combines these metrics into a composite score.

![post-session delivery breakdown](review)

There's also a github-style activity tracker using sessions that are persisted locally in IndexedDB. Nothing leaves the browser.

![practice activity over time](history)
