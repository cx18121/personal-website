---
name: coursemap
tagline: canvas → gcal event organizer
status: dormant
stack:
  - typescript
  - next.js
  - postgres
  - drizzle
  - anthropic api
  - canvas lms api
  - gcal api
live: https://coursemap-calendar-tracker.vercel.app
repo: https://github.com/cx18121/coursemap
---

Syncs canvas assignments and school calendar events into gcal, automatically organized by course and event type using Claude for classification.

## why

I built this because I wanted to import my canvas calendar to google calendar but my statistics professor would post exact office hours on canvas, 

## how it works

A scheduled job pulls assignments and events from the Canvas API, then asks Claude to classify them (ex. exam vs. problem set vs. reading vs. lab). Results are stored in Postgres so reclassification is incremental on subsequent syncs. Each course gets its own calendar option so that events are shown with type-specific colors and reminders on gcal.
