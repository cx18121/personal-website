---
name: gatekeeper
tagline: enforce your screen-time limits with an ai buddy
status: dormant
shipped: 2026-02
stack:
  - javascript
  - electron
  - node.js
  - gemini api
repo: https://github.com/cx18121/gatekeeper
release: https://github.com/cx18121/gatekeeper/releases/tag/v0.1.0
---

A desktop app that enforces per-app daily time limits, by forcing you to request screen-time from a chatbot that acts as a gatekeeper, so that you can only access the app if you can give a very good reason to do so.

![gatekeeper unlock request UI](hero "the unlock request flow: pick an app, state your reason, the model decides to accept/deny")

## why

I found myself spending a lot of time playing tft over winter break. So I decided to build an app that helps enforce my screen time limits by incorporating a chatbot that acts like an accountability buddy. I think this app would probably be better off as a mobile app to limit apps like Instagram though.


## how it works

Gatekeeper monitors configured app processes and blocks them unless the user has an active unlock ticket. Users request temporary access through a chat prompt, where Gemini evaluates the stated reason within the configured policy limits. Daily limits and allowed windows remain hard policy boundaries so once exhausted, access is denied rather than extended.
