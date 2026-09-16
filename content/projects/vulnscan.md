---
name: vulnscan
tagline: AST-based python vuln scanner with fix suggestions
status: dormant
stack:
  - python
  - click
  - anthropic api
repo: https://github.com/cx18121/vulnscan
---

A CLI that walks the AST of Python files looking for security problems and asks Claude to suggest a fix for each one.

## why

built to test some stuff out

## how it works

Each file gets parsed into an AST and I walk through it looking for the usual stuff: unsafe deserialization, SQL queries built with string concatenation, hardcoded secrets, weak hashing, and subprocess calls with shell=True. Each finding gets a severity and the file and line it was found at. Then it sends the finding plus the code around it to Claude and asks for a fix. You look at the suggestion and apply it yourself, it doesn't change your code for you.

