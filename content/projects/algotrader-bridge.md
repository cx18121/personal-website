---
name: algotrader-bridge
tagline: turn tradingview signals into automatic ibkr trading
status: live
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

A trading bridge that receives signals from TradingView via webhook and routes them to Interactive Brokers's TWS API for execution. Allows strategies writted in pinescript on TradingView to trade real positions through IBKR automatically. Connects to a live web dashboard to view trading activity.

## why

My friend has an algorithm on tradingview and he wanted to connect it to a dashboard that could track actual prices of positions and be able to support different strategies so I built this. Also this was built for Interactive Brokers instead of something like Alpaca because IBKR has the only API that supports trading futures.

## how it works

TradingView fires a webhook on buy/sell signal; this bridge validates the message, figures out the order intent, and places a trade via a running TWS session over IBKR's API. Position state and fills come back through the same connection. 

Currently I have the trading bridge deployed on a $5 digital ocean droplet so it can be active 24/7. The bridge supports paper trading and live trading.
