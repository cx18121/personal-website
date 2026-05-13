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

The content backlog is populated by scrapers: Reddit via public reddit.com/.json endpoints, and X/Twitter via Playwright against cookie-authenticated home feed/profile pages. Scraped posts go through a CLI workflow (scrape -> review -> generate -> run-cycle). Claude adapts Reddit posts into short, voice-friendly scripts; tweet videos narrate the tweet text directly. ElevenLabs renders narration with timestamps; FFmpeg assembles 1080x1920 videos. Storytelling videos use gameplay clips plus subtitles; tweet videos use a Playwright-rendered X template. Finished videos are then automatically uploaded through YouTube and Instagram APIs. Video states are stored in SQLite to help with collecting video analytics.

Got over 500k views from uploading these videos but decided to stop uploading and work on something with more social impact
