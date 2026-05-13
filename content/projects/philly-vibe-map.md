---
name: philly-vibe-map
tagline: view neighborhood vibes from 1.1M yelp reviews
status: live
featured: true
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

The pipeline fine-tunes DistilBERT with LoRA adapters for neighborhood-level sentiment classification, allowing the model to learn local review language without fully retraining the base transformer.

In parallel, the 1.1M Yelp reviews are embedded with a sentence-transformer model, indexed with FAISS for efficient similarity search, and clustered with BERTopic to surface recurring neighborhood vibes from review text.

Cluster outputs and sentiment predictions are aggregated across 157 Philadelphia neighborhoods, producing scores across six vibe dimensions, which are then rendered on the map.

![neighborhood vibe breakdown](detail)

There's also a search bar that lets you find neighborhoods by feeling. Matching neighborhoods get highlighted on the map.

![search neighborhoods by feeling](search)

A temporal slider lets you scrub through years to see how neighborhoods have shifted character over time.

![year-over-year character drift](timeline)
