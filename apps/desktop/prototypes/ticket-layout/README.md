# Ticket layout prototype

Three paired Session and Ticket shell variants, switchable with `?variant=`, answer one question:

> Which shell hierarchy keeps the Session roster useful while giving Ticket browsing and detail the width each needs?

Run from `apps/desktop`:

```sh
bun run prototype:ticket-layout
```

Open `http://127.0.0.1:5175/?variant=A`. Use the bottom switcher or the left and right arrow keys to change variants. Use the navigation rail to compare the Session and Ticket versions of each choice.

- **A · Context dock** — The shell dock changes with the surface. Sessions keep their roster. Tickets put the full searchable queue in the dock and give detail the main canvas.
- **B · Workbench** — The colored shell sidebar becomes stable global navigation. Session and Ticket lists become local workspace panes.
- **C · Focus flow** — Opening work compresses its list into a slim recall strip. The active transcript or detail uses almost the full window.

All records are sample data and all controls are inert. This is throwaway design code, not production UI.
