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

Scrapers fill a backlog: Reddit through the public .json endpoints, X through Playwright logged in with my cookies. From there it's a CLI flow of scrape, review, generate, run. Claude rewrites Reddit posts into short scripts that sound okay read aloud; tweet videos just read the tweet. ElevenLabs does the voice with word timestamps, and FFmpeg puts together a 1080x1920 video. Story videos get gameplay footage and subtitles, tweet videos get a screenshot of the tweet rendered with Playwright. Finished videos upload through the YouTube and Instagram APIs, and everything is tracked in SQLite so I can pull view counts later.

Got over 500k views from uploading these videos but decided to stop uploading and work on something with more social impact
