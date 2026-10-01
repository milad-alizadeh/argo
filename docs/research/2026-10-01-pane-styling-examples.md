# Proposed pane styling examples

2026-10-01. These are concrete targets for [S12 in the proposed contract](2026-10-01-component-styling-contract.md#s12-panes-surfaces-and-clipping), not implemented APIs or verified screenshots.
The [audit](2026-10-01-component-system-audit.md) identifies the current callers.
Keep the existing `styles/panel-layout.css` as the shared pane recipe owner.
Keep `AppShell`, `WorkspaceShell`, and `InspectorSplit` as layout owners.
Do not create a wrapper for every bordered `div`.

## Ownership diagram

```text
Theme CSS: color values for each theme and appearance
    |
    +-- background / foreground ------ window, chrome, content plane
    +-- card / card-foreground ------- sidebar, composer
    +-- muted / muted-foreground ----- raised rows and rails
    +-- popover / popover-foreground -- unanchored overlays
    +-- border / ring ---------------- structural edge / keyboard focus
    |
Tailwind bindings: bg-card, text-card-foreground, border-border, ...
    |
panel-layout.css: reusable frame, header, body, corner, divider recipes
    |
AppShell / WorkspaceShell / InspectorSplit
    +-- region selects its approved surface
    +-- split selects the single meeting edge
    +-- pane body clips its outer shape
    +-- viewport scrolls or virtualizes content
    +-- popup portals outside the body, under the same html theme
```

```text
Window: background
+---------------------------------------------------------------+
| Full-width chrome: background; one hairline at its foot        |
+-------------------+-------------------------------------------+
| Sidebar: card     | Content plane: background                  |
|                   |                                           |
| Body clips        | Body clips its outer corners               |
| outer corners     |                                           |
|                   | Scroll viewport                           |
| Scroll viewport   |                                           |
|                   | Composer: card + hairline; no shadow       |
+-------------------+-------------------------------------------+
                    ^
        One split separator draws this edge, not both bodies.

Menu above the window plane: popover + edge + overlay shadow.
It is not a child DOM box trapped inside the clipped pane.
```

This is not a fifth surface vocabulary.
It assigns the existing canonical roles from [ADR-0038](../adr/0038-the-desktop-cockpit-is-opaque.md#the-surface-table).
For the current canonical `sidebar` role, keep its assignment aligned with `card` unless a reviewed design establishes a distinct sidebar treatment.
Use the corresponding foreground pair for general text, with muted text only where the content hierarchy calls for it.

## Concrete CSS owner

Keep the existing frame, header, body, gutter, and corner utilities.
Replace `panel-content`'s Session-specific color alias with the canonical plane role.
Add a named sidebar body recipe only because multiple shells require that same treatment.
The following target declarations refine the existing utilities; they are not a second stylesheet to layer over them.

```css
/* styles/panel-layout.css: proposed replacements/addition */
@utility panel-frame {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background-color: var(--background);
  color: var(--foreground);
}

@utility panel-content {
  @apply panel-body;
  background-color: var(--background);
  color: var(--foreground);
}

@utility panel-sidebar {
  @apply panel-body;
  background-color: var(--sidebar);
  color: var(--sidebar-foreground);
}
```

`panel-body` already defines flex growth, minimum sizes, overflow clipping, and start/end corner variables.
Keep that geometry there, not in each page's local class string.
Keep `panel-header`'s shared height and `sidebar-gutter`'s inset there too.
Use ordinary Tailwind layout utilities for a one-off arrangement inside a pane.
Do not create `--tickets-pane-background` and `--sessions-pane-background` when both mean the same plane.

## Concrete JSX boundary

The target composition below uses the current registry Resizable exports and the existing pane utility pattern.
It omits domain content, collapse state, resize limits, and native drag controls to make the styling boundary visible.
The real layout owner retains those behaviors.

```tsx
<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel>
    <div className="panel-frame">
      <div className="panel-sidebar panel-outer-start panel-inner-end">
        <div className="min-h-0 flex-1 overflow-y-auto sidebar-gutter">
          {sidebarRows}
        </div>
      </div>
    </div>
  </ResizablePanel>

  <ResizableHandle />

  <ResizablePanel>
    <div className="panel-frame">
      <div className="panel-content panel-inner-start panel-outer-end">
        <div className="min-h-0 flex-1 overflow-y-auto">{pageContent}</div>
      </div>
    </div>
  </ResizablePanel>
</ResizablePanelGroup>
```

The separator already paints `bg-border` and provides keyboard focus and an expanded resize target.
Neither adjacent body adds `border-r` or `border-l` at that same boundary.
Do not modify its source to change the app's surface colors.
When a layout needs a divider below chrome only, own that named layout adaptation centrally and preserve its resize/focus target.

Native scrolling is intentional here.
Use ScrollArea only when its behavior is needed, through a scoped ScrollViewport adaptation if its scrollbar appearance must change.
For virtualized content, the existing Feed/list owner remains the viewport owner.
Do not add a second nested scrolling box around it.

## Border and clipping cases

| Case | Use | Do not use |
| --- | --- | --- |
| Sidebar beside content | One parent-owned separator; shared body recipes | Borders on both meeting children |
| Inspector inside content | Existing InspectorSplit; square internal corners | A Card around the entire inspector for its border |
| Embedded code/diff preview | Local content-frame recipe, with its own clipping requirement | Global `overflow-hidden` on every Card or code element |
| Long row title | `min-w-0` plus truncation at its text owner; full name remains accessible | Whole-row clipping that cuts off focus or action buttons |
| Dropdown in clipped pane | Registry portal outside clipping; root theme inherited | Moving the portal into the pane body to make colors inherit |
| Scrolling pane | One actual viewport, keyboard-reachable content | Both the body and nested list scrolling accidentally |
| Composer anchored to plane | `card`, paired text, one border, no shadow | Blur/translucency/elevation copied from overlay recipes |
| Dialog/popover | Default registry overlay shape unless a named adaptation is needed | Pane radius or gutter rules applied globally to every overlay |

Clipping is not the same as truncation, scrolling, or popup positioning.
Each has its own owner and proof.
Check visible keyboard focus near corners, long unbroken names, narrow panes, resizing, nested splits, and popups at edges in both appearances.
The source audit has not executed those rendered checks.
