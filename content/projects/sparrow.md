---
name: sparrow
tagline: cold email startups automatically
status: live
stack:
  - typescript
  - react
  - prisma
  - postgresql
  - supabase
  - anthropic api
aspect: 1770 / 1125
live: https://usesparrow.dev
repo: https://github.com/cx18121/sparrow
---

A cold-outreach tool for students trying to reach startups. Sparrow finds companies from VC portfolios, researches each one, writes a personalized email per person, and sends it from your own Gmail.

![sparrow workspace](hero)

## why

Originally built and ideated with Cornell GenAI. My friend and I were unemployed and needed to find summer internships, so we decided to create a tool to help us automatically contact startups for internships. We can report that Sparrow works! Right now I'm the primary developer and am working to add more companies to the database, and polish and add more features.

## how it works

Everything starts with a campaign. You pick an audience out of a shared pool of startups, which is built by scraping VC portfolio pages (YC, a16z, Sequoia, Lightspeed, IVP, and a bunch of others) plus Exa search for companies that aren't on any public portfolio list. You can filter by tags, stage, investor, region, YC batch, and whether they're hiring, then pull a batch of companies you haven't contacted yet.

![picking a campaign audience](audience)

For each saved company lead, Sparrow finds email addresses through Apollo.

![saved company leads](leads)

To write a draft, Sparrow first builds a short research report on the company with Exa (cached, so it's only done once per company). Claude then picks the one thing about the company that best connects to your resume and writes the email around it. You review and edit every draft before it goes out through your Gmail via OAuth.

![reviewing drafts](drafts)

After sending, each campaign shows opens, replies, and how each company turned out.

![campaign performance](campaign)

## decisions

Research uses Exa first and only falls back to Tavily when Exa returns nothing usable. I wrote a quick [benchmark](https://github.com/cx18121/search-api-benchmark) and Exa did the best for this kind of query.

There's one shared company database rather than one per user or campaign. Dedupe, tags, stage and region data, and the cached research reports all live in one place, so a company only gets researched once no matter how many campaigns target it.
