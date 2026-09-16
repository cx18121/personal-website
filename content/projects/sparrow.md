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

Everything is organized around campaigns. A campaign is an audience of startups pulled from a shared pool. The pool comes from VC portfolios (YC, a16z, Sequoia, Lightspeed, IVP, and others) plus Exa search for companies that aren't on any portfolio list. You can filter by tags, stage, investor, region, YC batch, and hiring signals, then pull a batch of companies you haven't emailed yet.

![picking a campaign audience](audience)

For each company you save, Sparrow looks up email addresses through Apollo.

![saved company leads](leads)

When you generate a draft, Sparrow first builds a research report on the company using Exa. The report is cached so each company is only researched once. Claude then reads your resume and the report, picks the one thing that connects them best, and writes the email around it. Drafts are reviewed and edited before sending through your own Gmail via OAuth.

![reviewing drafts](drafts)

Once emails go out you can see opens, replies, and the outcome for each company.

![campaign performance](campaign)

## decisions

Search goes through Exa first and only falls back to Tavily if Exa returns nothing useful. I wrote a quick [benchmark](https://github.com/cx18121/search-api-benchmark) to compare search APIs and Exa was the best for this kind of query.

There's one company database shared by everyone instead of one per user or campaign. Dedupe, tags, stage and region info, and the cached research reports are all in one place, and a company only gets researched once no matter how many campaigns target it.

