---
name: philly-vibe-map
tagline: view neighborhood vibes from 1.1M yelp reviews
status: live
stack:
  - python
  - typescript
  - react
  - fastapi
  - bertopic
  - distilbert
  - sentence-transformers
  - maplibre gl
live: https://philly-vibe-map.vercel.app
repo: https://github.com/cx18121/philly-vibe-map
---

An interactive map of Philadelphia neighborhoods, colored by the dominant "vibe" derived from NLP analysis of ~1.1 million Yelp reviews. A temporal slider lets you go through time to watch neighborhoods change character year over year.

![philadelphia vibe map](hero)

## why

The inspiration for this was neighborhood maps that I'd seen online, like [nyt map](https://www.nytimes.com/interactive/2023/upshot/extremely-detailed-nyc-neighborhood-map.html). I wanted to try to build something similar, but base it off public reviews. I wanted to originally make a map of NYC neighborhoods, but I couldn't find any free datasets of reviews. Eventually I settled on Philly because the Yelp open dataset had about 1.1 million reviews for Philly.

## how it works

There are two models. A DistilBERT fine-tuned with LoRA does sentiment on each review. LoRA meant I could train it on Philly review language without retraining the whole thing.

Separately, all 1.1M reviews are embedded with a sentence-transformer, indexed in FAISS, and clustered with BERTopic. The clusters are the "vibes", recurring themes that show up across reviews.

Sentiment and cluster results get rolled up across 157 neighborhoods into six vibe scores each, and those are what the map colors.

![neighborhood vibe breakdown](detail)

There's also a search bar. Type a feeling and the neighborhoods that match light up.

![searching by feeling](search)

The slider at the bottom scrubs through years so you can watch neighborhoods change.

![neighborhoods over time](timeline)
