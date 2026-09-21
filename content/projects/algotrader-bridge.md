---
name: algotrader-bridge
shipped: 2026-04
stack:
  - python
  - fastapi
  - sqlite
  - sqlalchemy
  - ibkr tws api
  - docker
repo: https://github.com/cx18121/algotrader-bridge
---

A trading bridge that receives signals from TradingView via webhook and routes them to Interactive Brokers' TWS API for execution. Lets strategies written in Pine Script on TradingView trade real positions through IBKR automatically. A live dashboard shows trading activity.

## why

My friend has an algorithm on tradingview and he wanted to connect it to a dashboard that could track actual prices of positions and be able to support different strategies so I built this. Also this was built for Interactive Brokers instead of something like Alpaca because IBKR has the only API that supports trading futures.

## how it works

TradingView fires a webhook on a buy or sell signal. The bridge checks the message, works out what order it means, and places it through a running TWS session. Positions and fills come back over the same connection.

Currently I have the trading bridge deployed on a $5 DigitalOcean droplet so it can be active 24/7. The bridge supports paper trading and live trading.
