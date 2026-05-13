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

A CLI tool that analyzes Python source files for security vulnerabilities using AST traversal, with AI-powered fix suggestions via the Claude API.

## why

built to test some stuff out

## how it works

Each source file is parsed into an AST and walked for known dangerous patterns: unsafe deserialization, SQL string concatenation, hardcoded secrets, weak hashing, shell-true subprocess calls. Findings are classified by severity and emitted with file/line context. Each finding is sent to Claude alongside the surrounding code for a fix suggestion which the user reviews and applies changes manually rather than auto-patching.
