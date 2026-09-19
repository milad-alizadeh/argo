# Project setup loads a GitHub document

Status: accepted (#2392) · 2026-09-18

The desktop app loads the Setup document from the Argo repository on GitHub. The app uses a fixed
URL for the `main` branch. A development launch uses the current GitHub branch so that an unmerged
Setup document can drive the app. Project setup requires a network connection. There is no offline
path.

The app does not use a signed manifest while it is in pre-release development. The Setup document
contains a revision, generic fields, a recommended plan, and the initial Project configuration.
The app validates the document before it sends the document to the renderer. An invalid document
stops setup.

The renderer uses generic controls for text, choices, and Boolean values. Each field names its path
in `.argo/settings.json`. The configuration editor shows the complete result before the person
saves it. Stable field IDs and configuration paths restore saved answers after setup restarts.

SQLite stores the selected document revision with the setup checkpoint. A newer document can add
fields or change the plan, but it cannot modify a ready Project without a new setup review.

This decision replaces the signed bundle design from #2381 for the pre-release app. Before Argo
ships to users, a separate decision must define source authentication and release controls.
