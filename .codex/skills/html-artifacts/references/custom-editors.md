# Custom Editors

Build a focused, single-file editor when the user needs to manipulate structured data that is awkward to express in chat: triage and ordering, constrained configuration, prompt tuning, dataset curation, annotation, colors, easing curves, schedules, or regex testing.

The work area should dominate. Pre-fill the user’s data, choose controls that match the data type, expose validation and state counts immediately, support keyboard shortcuts for repetitive work, and add undo/redo when it materially helps.

Every editor must export its state. Provide “Copy as markdown,” “Copy as JSON,” “Copy as prompt,” CSV download, or another pasteable format. The export path is mandatory and should be designed before secondary features.

For local HTML files, session persistence may use localStorage; constrained artifact environments should use in-memory state. Keep the tool task-specific: no backend, authentication, generic settings system, or unnecessary product architecture.