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

Before you start you set up your camera and mic, pick a topic, and choose how long you want to talk for.

![session setup](setup)

Everything runs locally in the browser. There are three MediaPipe models running at the same time in a Web Worker, one for where you're looking, one for hand gestures, and one for how expressive your face is. The audio goes through the Web Speech API and Whisper for a transcript, which is used to measure pacing, pauses, and filler words. Filler word detection looks at the surrounding words so it doesn't flag every "like". At the end all six metrics are weighted into one score.

![the breakdown after a session](review)

There's also a GitHub style activity grid of your sessions. Sessions are saved in IndexedDB, so nothing leaves the browser.

![practice history](history)

