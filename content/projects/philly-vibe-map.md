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

There are two models doing different jobs. The first is DistilBERT fine tuned with LoRA to do sentiment on each review. I went with LoRA because I wanted it to pick up on how people talk about Philly specifically without having to retrain the whole model.

The second part is the "vibes" themselves. I embed all 1.1M reviews with a sentence-transformer, put them in FAISS, and cluster them with BERTopic. The clusters that come out are basically themes that keep showing up across reviews, and those became the vibes.

Then everything gets rolled up by neighborhood. There are 157 of them, and each one ends up with a score on six vibe dimensions, which is what decides its color on the map.

![neighborhood vibe breakdown](detail)

There's also a search bar where you can type a feeling and it highlights the neighborhoods that match.

![searching by feeling](search)

And there's a slider at the bottom to go through the years and watch neighborhoods change.

![neighborhoods over time](timeline)

