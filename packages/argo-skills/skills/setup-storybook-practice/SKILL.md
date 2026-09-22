---
name: setup-storybook-practice
description: Install Storybook as a real component test — CSF3 stories, a required accessibility gate staged in, and a two-theme CI run — with a checklist for writing each new story.
disable-model-invocation: true
---

# Setup Storybook Practice

Storybook reviewed as pictures catches nothing a bug can hide behind; Storybook run as a test
does. This is what to install, in what order, and the checklist a story author follows after.
Argo's own config (`apps/desktop/.storybook/main.ts`, `preview.ts`, `storybook-host.ts`) is a
worked example, not the thing to copy — copy the shape, use this project's own component paths.

## 1. Install, in this order

1. **Storybook itself**, with the framework preset for the project's bundler (Argo:
   `@storybook/react-vite`). Point `stories` at the real component globs, not a wildcard over
   the whole source tree — a story glob that reaches test fixtures or generated code produces
   stories nobody wrote.
2. **`@storybook/addon-vitest`.** This is what turns a story into a real test: every story with
   a `play` function runs as a Vitest assertion, in CI, not just a page a human loads. Without
   it, "reviewed in Storybook" means someone looked, once.
3. **`@storybook/addon-a11y`**, after the vitest addon, not instead of it — the a11y check
   below runs inside the same test pass. Do not add a separate documentation, design-file
   (Figma-embed) or theme-switcher addon at this step; step 5 says why each is skipped.

## 2. One story format: `satisfies Meta`, not the annotated form

```ts
const meta = {
  title: 'Group/Component',
  component: MyComponent,
} satisfies Meta<typeof MyComponent>
export default meta
type Story = StoryObj<typeof MyComponent>
```

`satisfies` narrows `args` against the component's real prop types at the definition site — a
typo in an arg name or a wrong prop shape fails the type check right there, at the story that
made the mistake. The older annotated form (`const meta: Meta<typeof C> = {...}`) accepts
anything shaped roughly like `Meta`, so the same typo passes until something downstream breaks.
CSF3 (Component Story Format 3, current since Storybook 7) recommends `satisfies` for this
reason; make it the one form every story in the project uses, and migrate files written in the
older form rather than let both stand.

**`title` is explicit and nested**, one path segment per owning parent component, matching the
file's folder placement (a shared cross-domain primitive stays under a top-level group such as
`Components/`). Do not let Storybook's automatic title inference pick the group — a moved file
silently changes where its story sits in the sidebar, with no diff to review.

## 3. Stage the accessibility gate in at `'todo'`, then move it to `'error'`

In `preview.ts`, `parameters.a11y.test` starts at `'todo'`: violations are reported, not failed,
so turning the addon on does not fail the whole existing story suite on day one. Work through
what it finds — most findings are a shared design token failing contrast against a background
its own definition never listed, so fix the token before reaching for a per-story override.
Only disable an axe rule for markup the project did not author (a vendored library's own
internal DOM), name that vendored element on the same line, and never disable a rule to silence
a first-party finding — that hides it instead of fixing it.

Once the triaged suite is clean, move `test` to `'error'` and say so in a comment at the site:
a future contributor reading `'error'` with no note might "fix" a false-positive failure by
lowering it back to `'todo'`, undoing the gate. Record instead that the grade is deliberate and
the suite was clean when it landed, so a new failure from here on is a real regression.

## 4. `view-only` marks a story that carries no assertion, on purpose

A story with no `play` function is a visual snapshot, reviewed by eye, not tested. Give it the
`tags: ['view-only']` marker rather than leaving it bare — an untagged story with no `play` is
indistinguishable from an author who forgot to write one. Reserve real `play` functions for the
handful of stories that exercise the component's actual interactive paths; every other state of
the same component variant is `view-only`.

## 5. Run every story in both themes, and keep the rest of this list as-is

Wire the test run as two Vitest projects — one per theme (Argo:
`--project=storybook-dark --project=storybook-light`) — with a preview decorator that flips
the theme class and re-answers the appearance query the component reads. A component that is
right in one theme and wrong in the other is exactly the failure a single-theme run cannot
catch, and it is cheap: the same story, run twice.

Two more deliberate holds, worth recording so a future edit does not undo them by habit:

- **A preload-bridge stub** (`storybook-host.ts` in Argo) answers every call a component would
  otherwise make into the app's native bridge, with fixture data. Stories run with no real
  backend; the stub is what makes that possible without every component branching on
  "am I in Storybook."
- **Explicit story titles** (step 2) over inferred ones, for the reason given there.

**What was deliberately not adopted, and why:**

- **A documentation addon** (MDX docs pages, `autodocs`) — worth it for a published component
  library whose consumers read a props table; skipped for an internal cockpit nobody browses as
  documentation.
- **A design-file addon** (embedding Figma in the addon panel) — there is no Figma file that is
  the source of truth here; the design tokens file already is one.
- **A themes-switching addon** (a toolbar control that flips theme for a human looking at one
  story at a time) — the two-theme CI run above already renders and tests both themes on every
  story; a toolbar switch is a weaker, manual version of a check that already runs
  automatically.
- **A screenshot-based visual regression service** (Chromatic, Percy, or similar) — no gate here
  takes a screenshot, and none holds a reference image to diff against. A `play` function
  asserts what a reader would see (a role, a label, a state), which survives an unrelated pixel
  shift that a screenshot diff would flag as a false failure; a reviewer reads pixels by hand
  against the live preview instead.

## 6. Checklist for a new story

- [ ] `title` set explicitly, nested one level per owning parent component.
- [ ] `satisfies Meta<typeof Component>`, never the annotated form.
- [ ] Every distinct visual state has a story; the ones with no `play` carry `tags: ['view-only']`.
- [ ] A `play` function on the states that exercise a real interaction asserts what a reader
      sees — a role, a label, a state — never a CSS class or a computed style.
- [ ] The story runs clean under the a11y gate at its current grade (`'error'` once triaged); a
      real finding is fixed at the shared-token level first, never suppressed inline.
- [ ] No new addon reached for without checking this list first.
