# Diagrams & Illustrations

Use inline SVG rather than ASCII diagrams or prose descriptions.

For figure sheets, put each figure in its own `<figure>` with a caption and a copy-SVG control. Keep line weight, arrowheads, palette, and typography consistent across the set.

For annotated flowcharts, hand-place clear nodes and directed edges, highlight the happy path, distinguish failure and retry paths by shape as well as color, and let users click nodes to open supporting details. Include a legend.

Use `viewBox`, `currentColor` where practical, round coordinates, meaningful `<g>` groups, selectable SVG text, and accessible titles. Avoid raster fallbacks, tangled auto-layout, and diagrams that attempt to show every rare edge case.