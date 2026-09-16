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

An interactive map of Philadelphia neighborhoods, colored by the dominant "vibe" derived from NLP analysis of ~1.1 million Yelp reviews. A slider lets you go through the years and watch neighborhoods change.

![philadelphia vibe map](hero)

## why

The inspiration for this was neighborhood maps that I'd seen online, like [nyt map](https://www.nytimes.com/interactive/2023/upshot/extremely-detailed-nyc-neighborhood-map.html). I wanted to try to build something similar, but base it off public reviews. I wanted to originally make a map of NYC neighborhoods, but I couldn't find any free datasets of reviews. Eventually I settled on Philly because the Yelp open dataset had about 1.1 million reviews for Philly, which seemed sufficient.

## how it works

There are two models. A DistilBERT fine tuned with LoRA does sentiment on each review. LoRA lets it learn how people talk about Philly specifically without retraining the whole model. Probably wasn't entirely necessary to use LoRA but I wanted to try it out and test its effectiveness.

The vibes come from clustering. All 1.1M reviews are embedded with a sentence-transformer, indexed with FAISS, and clustered with BERTopic. Each cluster is a theme that keeps showing up across reviews, and those became the vibes.

Sentiment and cluster results are then aggregated across the 157 neighborhoods. Each neighborhood gets a score on six vibe dimensions, and that decides its color on the map.

![neighborhood vibe breakdown](detail)

There's also a search bar where you can type a feeling and it highlights the neighborhoods that match.

![searching by feeling](search)

A slider at the bottom goes through the years so you can see how neighborhoods changed.

![neighborhoods over time](timeline)
