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

Built for the NYU startup week hackathon. We looked into how charter flight operators work and a surprising amount of it still runs on people reading emails and doing things by hand. Requests get typed up manually, routing is done by hand, and planes end up flying back empty a lot because nobody has a full view of the fleet at once. We wanted to put all of that in one place.

## how it works

When a request comes in over email, the system pulls out the trip details, so the route, dates, how many passengers, what kind of aircraft they want, who the client is, and any special requests. You can look over what it extracted and fix anything before it moves on to quoting.

The quote gets built from the aircraft category, route distance, fuel, FBO fees, repositioning, catering, permits, margin, and tax. Every line item is shown so the operator can see exactly how the price was put together.

The dashboard tracks everything over time. Open quotes, confirmed trips, how much each aircraft is getting used, which ones are sitting idle, demand forecasts, and suggestions for when to reposition a plane or schedule maintenance.

