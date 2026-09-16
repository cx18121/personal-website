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

A charter flight ops tool. It reads booking requests out of emails, builds the quote and routing, and flags idle aircraft.

![skyops dashboard](hero)

## why

Built for the NYU startup week hackathon. A lot of charter flight operations still run on people reading emails and doing things by hand. Requests get typed up manually, routing is done by hand, and planes fly back empty because nobody has a full view of the fleet. We wanted to put all of that in one place.

## how it works

When a request comes in over email, the system extracts the trip details: route, dates, passenger count, aircraft preference, client, and any special requests. The extracted fields can be reviewed and edited before the request moves on to quoting.

The quote is built from the aircraft category, route distance, fuel, FBO fees, repositioning, catering, permits, margin, and tax. Every line item is shown so the operator can see exactly how the price was calculated.

The dashboard shows open quotes, confirmed trips, aircraft utilization, idle aircraft, demand forecasts, and suggestions for repositioning or maintenance windows.

