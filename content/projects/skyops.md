---
name: skyops
tagline: charter flight operations platform
status: live
shipped: 2026-03
stack:
  - typescript
  - react
  - next.js
  - anthropic api
  - postgresql
live: https://skyops-ai.vercel.app/dashboard
repo: https://github.com/erics118/skyops
---

A charter flight ops tool. It reads booking requests out of emails, builds the quote and routing, and points out where the fleet is sitting idle.

![skyops dashboard](hero)

## why

Built for the NYU startup week hackathon. We talked to a few charter operators and the pattern was the same everywhere: requests come in by email, someone retypes them into a spreadsheet, quotes get built by hand, and planes fly back empty because nobody is looking at the whole fleet at once. We wanted one screen that did all of that.

## how it works

When a request email comes in, Claude pulls out the trip details: route, dates, passenger count, aircraft preference, client, and anything unusual. You check the fields and fix anything it got wrong before it goes to quoting.

The quote is built from aircraft category, distance, fuel, FBO fees, repositioning, catering, permits, margin, and tax, with every line shown so the operator can see where the number came from.

The dashboard shows open quotes, confirmed trips, utilization per aircraft, and which planes are idle, and suggests repositioning or maintenance windows when there's a gap.
