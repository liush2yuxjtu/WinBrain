# Code Review & PR Writeups

Use HTML when diffs, call graphs, before/after states, or module relationships are central.

## Annotated diff

Render the diff as the spine of the page with syntax-aware added/removed/context lines. Pin numbered margin annotations to specific lines, label findings by severity, provide jump links, and collapse file sections for larger changes. Include a short “where to focus” block.

Do not interleave long prose between code fragments or detach findings from the lines they concern.

## PR writeup

Include motivation, an actual side-by-side before/after when output or UI changed, a thematic file tour, review focus, testing, risks, and open questions. Group changes by purpose rather than alphabetically.

## Module map / code explainer

Start with a one-sentence purpose statement, then draw an inline-SVG boxes-and-arrows map. Highlight the hot path, identify entry points by use case, summarize each important module, and trace one realistic input through its lifecycle. Prefer structural relationships over an unreadable graph of every import.