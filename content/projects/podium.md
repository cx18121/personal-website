---
name: podium
tagline: on-device speech practice app
status: live
stack:
  - typescript
  - react
  - mediapipe
  - whisper.wasm
  - indexeddb
live: https://podium-speech-practice.vercel.app/
repo: https://github.com/cx18121/podium
---

A presentation practice tool that runs in the browser. It records your webcam and mic, then scores your delivery on eye contact, filler words, pacing, and a few other things, all with on-device models.

![podium practice](hero)

## why

I wanted to get better at speaking into a camera, since I realized that while speaking, I'd often take long pauses without noticing, talk too fast, break eye contact, and include lots of filler words, so I built this with the goal to help me improve.

## how it works

Before starting, you set up the camera and mic, pick a topic, and choose a duration.

![session setup](setup)

Video and audio stay in the browser. Three MediaPipe models run in a Web Worker at the same time, one each for gaze, gestures, and facial expressiveness. The Web Speech API and Whisper transcribe the audio, which is how it catches pacing, pauses, and filler words (with enough context to tell "like" the filler from "like" the verb). Six metrics total, weighted into one score at the end.

![the breakdown after a session](review)

There's a GitHub-style activity grid too. Sessions are saved in IndexedDB, so nothing leaves the browser.

![practice history](history)
