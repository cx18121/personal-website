---
name: auto-shorts
tagline: end-to-end shortform video pipeline
status: live
shipped: 2026-03
stack:
  - python
  - ffmpeg
  - playwright
  - sqlite
  - anthropic api
  - elevenlabs
  - youtube api
  - instagram graph api
repo: https://github.com/cx18121/auto-shorts
---

A CLI pipeline that automatically produces short-form videos. The full system scrapes/scores content from reddit/x, generates scripts and videos, and uploads to YouTube Shorts + Instagram Reels.

## why

I saw that ai-generated brainrot content was getting crazy amounts of views on yt and ig so I thought that I could build this and try to make some money. Spoiler alert: I did not make any money.

## how it works

It scrapes Reddit through the public .json endpoints and X with Playwright using a logged in session, and everything goes into a backlog. Posts in the backlog are reviewed by hand before anything gets generated.

For Reddit posts, Claude rewrites the post into a script that fits in a short and doesn't sound weird when it's read out loud. Tweets don't need a script, it just reads the tweet. ElevenLabs does the voice and gives back timestamps for each word, which is how the subtitles stay synced. Then FFmpeg renders a 1080x1920 video. Reddit stories get gameplay footage in the background, tweets get a screenshot of the tweet rendered with Playwright.

After that it uploads to YouTube and Instagram through their APIs. Every video is tracked in SQLite so analytics can be collected later.

Got over 500k views from uploading these videos but decided to stop uploading and work on something with more social impact
