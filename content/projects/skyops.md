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

An AI-powered charter flight ops platform that parses booking requests from emails and automates flight quoting, routing, and pricing, and provides suggestions to improve plane management.

![skyops operations dashboard](images/SkyOps.webp "operations overview: pipeline, fleet health, and live operations map")

## why

Built for the NYU startup week hackathon. We realized that charter operators waste time and lose potential revenue due to fragmented data, manual routing, and empty legs. They depend on humans for a lot of the work, leading to potential losses and errors. This also leads to suboptimal routing, underutilized aircraft, and costly empty-leg flights. We saw an opportunity to create a centralized decision-making platform.

## how it works

When a new charter request comes in, the system extracts the key trip details: route, date and time, passenger count, aircraft preferences, client information, and special requirements. Users can
review and edit the extracted fields before moving the request into quoting.

From there, SkyOps helps build the quote using aircraft category, route distance, fuel estimates, FBO fees, repositioning costs, catering, permits, margin, and tax. The quote is generated with a clear cost breakdown, so operators can understand exactly how the final price was calculated.

The dashboard also tracks operational performance over time. Operators can see open quotes, confirmed trips, recent activity, aircraft utilization, idle aircraft, capacity gaps, demand forecasts, and
recommendations for repositioning or maintenance windows.
