---
name: sparrow
tagline: cold email startups automatically
status: live
featured: true
stack:
  - typescript
  - vite
  - react
  - prisma
  - postgresql
  - supabase
  - anthropic api
  - exa
  - apollo
live: https://usesparrow.dev
repo: https://github.com/cx18121/sparrow
---

A campaign-based cold-outreach tool built for students reaching out to startups. Sparrow sources contacts from VC portfolio databases, generates an AI-personalized email per recipient grounded in a per-company research report, and sends through the user's own Gmail.

![sparrow workspace](hero)

## why

Originally built and ideated with Cornell GenAI. My friend and I were unemployed and needed to find summer internships, so we decided to create a tool to help us automatically contact startups for internships. We can report that Sparrow works! Right now I'm the primary developer and am working to add more companies to the database, and polish and add more features.

## how it works

Sparrow is a campaign-first cold-outreach workspace for students. A campaign defines an audience over a shared startup pool: VC portfolio sources like YC, a16z, Sequoia, Lightspeed, IVP, and many others are ingested through adapters, while Exa discovery can add companies outside public portfolio lists. Users can then filter by tags, stage, investor, region, YC batch, and hiring signal, and pull batches of companies while avoiding repeats.

![defining a campaign audience](audience)

For each saved company lead, Sparrow finds email addresses through Apollo.

![saved company leads](leads)

When a draft is generated, Sparrow builds or reuses a cached company dossier of features through Exa web search. Claude then picks a resume-grounded feature line based on the user's resume and context in order to provide personalization to emails. Drafts are then reviewed and edited before sending through the user's own Gmail via OAuth.

![ai-personalized draft review](drafts)

Once emails go out, campaigns show opens, replies, and per-company outcomes in the workspace.

![campaign performance](campaign)

## decisions

```decisions
Layered Exa primary, Tavily rescue fallback for search | production research uses Exa search plus company-site contents first; Tavily only runs when Exa returns zero usable results. I created a quick [benchmark](https://github.com/cx18121/search-api-benchmark) which found that Exa performed the best for this specific use case.
One shared company database | ingest VC portfolios and discovery sources into a global Company pool, then let campaigns filter and batch from that shared data. This keeps dedupe, tags, stage/region enrichment, and cached dossiers consistent instead of rebuilding company context for every campaign and user.
```
