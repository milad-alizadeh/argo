# XState v5 and React Router v7 in an Electron renderer

Date: 2026-09-20

Question: How can an Electron renderer use React Router with one durable XState actor as the
authority for onboarding state?

## Findings

React Router defines a route as a projection of a location. Its history object reports `POP`,
`PUSH`, and `REPLACE` actions when the URL changes. React Router recommends creating a data router
once, outside the React tree. See [React Router history concepts](https://reactrouter.com/docs/en/v6/start/concepts)
and [`createHashRouter`](https://api.reactrouter.com/v7/functions/react-router.createHashRouter.html).

XState defines an actor as a live process with private state. Other code sends events or reads
emitted snapshots. XState v5 can persist an actor with `getPersistedSnapshot()` and restore it with
`createActor(logic, { snapshot })`. See [XState actors](https://stately.ai/docs/actors) and
[XState persistence](https://stately.ai/docs/persistence).

These rules support one authority. In one process, React components can read an actor with
`useSelector`. See [XState React](https://dev.stately.ai/docs/xstate-react). Argo keeps its actor in
the main process, so the renderer receives validated projections through IPC instead. The route
does not store a second copy of onboarding progress.

## `createHashRouter` in Electron

`createHashRouter` stores the application path in `window.location.hash`. This works in an Electron renderer because the renderer runs a browser DOM and history implementation. Electron documents a hash change as an in-page navigation. It emits `did-navigate-in-page`, not a document navigation. See [`createHashRouter`](https://api.reactrouter.com/v7/functions/react-router.createHashRouter.html) and Electron [`webContents` navigation events](https://www.electronjs.org/docs/latest/api/web-contents#event-did-navigate-in-page).

The Electron main process history API is a separate layer. `webContents.navigationHistory` controls page navigation in the `WebContents` object. React Router does not call that API. Therefore, renderer Back and Forward work through the renderer's `window.history` and hash changes when the app stays in one document. Do not treat `webContents.navigationHistory` as the onboarding history. See Electron [`webContents` navigation history](https://www.electronjs.org/docs/latest/api/web-contents#contentsnavigationhistory).

## Coordination when each step needs a URL

If a product needs a URL for each workflow step, use a one-way projection:

1. Restore or create the onboarding actor before rendering onboarding routes.
2. Select the actor's current screen from its snapshot.
3. When that selected screen changes, call the router with `replace` to update the hash. Use `replace` for a projection so each actor transition does not create a second durable history.
4. When the user acts, send a domain event to the actor. Do not navigate first and then ask the actor to catch up.
5. If a location arrives from a deep link or Back/Forward, parse it at the boundary and send an explicit actor event such as `requested step`. The actor accepts, rejects, or redirects it. The next actor snapshot projects the canonical route.

This avoids two writers. The actor writes durable state. The router writes a view of that state. A route can show a loading, error, or recovery screen while the actor restores, but it must not infer that a route alone means that onboarding progress was completed.

## Back, Forward, and deep links

Hash entries participate in the renderer's browser history, so a Back or Forward action changes the hash and causes React Router to receive a `POP`. Treat `POP` as user intent, not as an unconditional state transition. Translate it into an actor event, then project the actor's accepted state back to the router. If the actor rejects the request, use `replace` to return to the canonical route. This can create a short URL change before the actor responds, so render the actor snapshot as the visible authority.

For an external deep link, Electron delivers the URL to the main process on cold start and through the platform URL events. The Electron [deep links guide](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app) shows both paths. Pass the parsed link to the renderer as input or an IPC message. Convert it to an actor event after validation. Do not let a deep link skip actor guards or restore a different durable snapshot.

If the app needs true browser-like addressability for every step, hash routes are suitable for the renderer. If it needs only internal view switching, a memory router avoids URL history, but it also removes addressable deep links. React Router's official guidance does not define a router and XState coordination pattern for durable workflows. The official XState and React Router examples cover their own state and navigation models, not their combination. The one-way projection above is an architecture inference from those contracts, not an official combined recipe.

## Argo decision

Keep one long-lived onboarding actor outside route components. React Router owns only the
`/projects/:projectId/setup` application route. Folder selection and Project registration happen
before this route opens. The actor owns every page and Back transition inside the route, so Argo
does not synchronize each onboarding phase with a URL. Restore the actor before rendering the
route, and send every onboarding action to the actor through the IPC contract.
