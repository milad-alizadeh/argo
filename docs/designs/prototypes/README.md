# Throwaway prototypes

**These are primary sources, not starting points.** Each one exists so the decisions in its
ticket can be *looked at* rather than read. They live on throwaway branches, not on `main`:
they were written under prototype constraints — no tests, no abstractions, one file each — and
the validated decisions live in the spec and the ticket, not here.

> `docs/designs/README.md` records that HTML studies were retired from the committed design set
> when the runtime locked to Swift (ADR-0022). This is not a re-opening of that: these are
> throwaways on throwaway branches, which is where the `prototype` skill puts them.

Each is a single file. No build, no server, no dependencies.

| File | Ticket | Question it answered | Notes |
|---|---|---|---|
| `roster-header-prototype.html` | [#502](https://github.com/milad-alizadeh/argo/issues/502) | What should the Sessions roster row and the Session deck header show? | [`roster-header-prototype.md`](roster-header-prototype.md) |
| `composer-permission-prototype.html` | [#536](https://github.com/milad-alizadeh/argo/issues/536) | What do the composer, attachment chips and the Permission prompt look like, and does the Dock survive? | [`composer-permission-prototype.md`](composer-permission-prototype.md) |
| `composer-picker-prototype.html` | [#590](https://github.com/milad-alizadeh/argo/issues/590) | What do the `/` picker and the `+` menu look like, over the composer #536 froze? | [`composer-picker-prototype.md`](composer-picker-prototype.md) · renders in [`picker/`](picker/) |

```sh
open docs/designs/prototypes/<file>.html
```

Everything in all three is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` — `GraphitePalette`,
`ArgoGeometry`, `ArgoLayout`, `ArgoTypography`. Nothing is invented, and type is San Francisco
throughout: the contract carries `interface` and `machine` and no serif.
