---
name: vulnscan
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

Each file is parsed into an AST and walked for known dangerous patterns: unsafe deserialization, SQL queries built with string concatenation, hardcoded secrets, weak hashing, and subprocess calls with shell=True. Each finding gets a severity and a file and line. The finding and its surrounding code are sent to Claude for a suggested fix. Fixes are applied manually, the tool doesn't patch anything itself.
