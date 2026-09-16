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

Each file is parsed into an AST and checked for the usual suspects: pickle on untrusted input, SQL built by string concatenation, hardcoded secrets, MD5 and SHA1, subprocess with shell=True. Findings get a severity and a file and line. Each one is sent to Claude with the surrounding code for a suggested fix, which you apply yourself. It doesn't patch anything automatically.
