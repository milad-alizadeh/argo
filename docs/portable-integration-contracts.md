# Portable integration contracts

This is the Project-opening proof for [#1825](https://github.com/milad-alizadeh/argo/issues/1825),
extended by the registration slice for [#1828](https://github.com/milad-alizadeh/argo/issues/1828).
The accepted migration spec is [#1824](https://github.com/milad-alizadeh/argo/issues/1824).
It preserves the Project and storage rules in `CONTEXT.md`, ADR-0015, and ADR-0017.
It does not settle the remaining product choices listed below.

## One opening workflow

The renderer requests a registered Project by its stable ID.
The main process finds that ID in its own registry and reads the registered directory.
It returns the Project's ID and display name, or a defined error.
The preload validates that reply before the renderer receives it.

Registration, listing, and relocation are three further actions on the same channel.
The renderer names the action and nothing else. It never names a folder.
The main process opens the folder chooser, establishes that the chosen folder is a git root, and writes the registry.
A chosen folder that is already registered selects the existing identity. It never mints a second one.
Relocation moves the stored path of an identity the renderer names. The ID does not change.
The selected Project is stored beside the registrations, so the next launch reopens it.

This slice does not import Swift data.
Every later filesystem operation must recheck access because this reading grants no lasting permission.

The complete route is:

1. The main process chooses `<userData>/portable-v1/projects.json` in `src/projects/bridge.ts`.
2. `src/projects/open-project.ts` parses stored registrations and resolves the requested ID.
3. `src/projects/register-project.ts` and `src/projects/list-projects.ts` own the chooser, the git check in `src/projects/repository.ts`, and the writes in `src/projects/registry.ts`.
4. The window-scoped Electron handler accepts only its trusted top-level renderer document.
5. `src/preload.ts` exposes `window.argo.openProject(request)` and the three further actions through one named IPC channel.
6. `src/projects/client.ts` validates each reply and its request and Project IDs.
7. The renderer receives the versioned presentation messages defined in `src/projects/contract.ts` and `src/projects/messages.ts`.

All source paths above are relative to `apps/desktop`.
The shared contract and client use ordinary TypeScript without Electron or Node imports.
The main adapter owns file access and Electron wiring.
No Swift package or module hierarchy defines these boundaries.

## Message contract

Version 1 is an exact message shape, shared by the bundled main process and renderer.
An unsupported numeric request version returns `unsupported-version` before storage is read.
Malformed versions, unknown actions, extra request fields, and invalid IDs return `invalid-request`.
A contract change that changes accepted fields or meanings requires a new version and corresponding validators.

The action carries no path, provider selector, token, command line, or IPC channel:

```json
{"version":1,"type":"project.open","requestId":"open-1","projectId":"project-1"}
```

The success message contains only presentation data:

```json
{"version":1,"type":"project.opened","requestId":"open-1","project":{"id":"project-1","name":"example"}}
```

The failure message has one code and fixed text from the contract:

```json
{"version":1,"type":"project.error","requestId":"open-1","code":"missing-project","message":"This Project is not registered."}
```

Version 1 gains actions and never changes a message it already defines, so a `project.open` exchange is byte-identical to the one #1825 accepted.
The three added actions are `project.list`, `project.register`, and `project.relocate`.
Only `project.relocate` carries a `projectId`. The other two carry a version, a type, and a request ID.

Each of the three answers with the whole known set, so the renderer never assembles storage out of a sequence of replies:

```json
{"version":1,"type":"project.listed","requestId":"list-1","projects":[{"id":"project-1","name":"example","path":"/Users/me/example"}],"selectedId":"project-1"}
```

A `selectedId` is `null` or names a listed Project. A reply that points at an unlisted ID is malformed.
A dismissed folder chooser answers `project.cancelled`, which reports that nothing was read and nothing was written:

```json
{"version":1,"type":"project.cancelled","requestId":"register-1"}
```

The Project ID stays unchanged when its path or name changes.
The caller supplies a distinct request ID for each in-flight request and matches the returned ID before applying it.
Both IDs are nonempty strings of at most 256 characters without whitespace or control characters.
The request ID is `null` only when the incoming request carries no valid request ID.
IDs identify records and requests. They do not grant authority.

The client also refuses unexpected reply versions, extra reply fields, unknown errors, and mismatched request or Project IDs.
Error text comes from `PROJECT_ERRORS`, which is the source of truth for wording.
Neither side sends exception objects, stack traces, paths from failures, or provider responses.
The operation does not retry automatically or emit background events.

| Code | Meaning |
| --- | --- |
| `missing-project` | The readable registry contains no matching ID. |
| `project-unavailable` | The registered path is absent or is not a directory. |
| `access-denied` | The operating system denies directory access, or the sender document is not trusted. |
| `storage-unavailable` | The registry file cannot be read, including when import has not created it. |
| `storage-invalid` | The registry is malformed, uses another version, or has ambiguous IDs. |
| `invalid-request` | The action fails validation. |
| `unsupported-version` | The requested numeric protocol version is unsupported. |
| `internal-error` | Another directory failure prevents opening. |
| `invalid-response` | The preload refuses the reply. |
| `connection-lost` | The IPC call fails before a valid reply arrives. |
| `not-a-repository` | The chosen folder holds no git root. |
| `already-registered` | Another Project is already registered at that folder. |
| `git-unavailable` | git cannot be run on this computer. |
| `storage-not-written` | The registry cannot be saved. |

## Accounts and Tickets

[#1848](https://github.com/milad-alizadeh/argo/issues/1848) adds two more channels with the same rules: `argo:account` and `argo:ticket`.
Their version 1 messages are zod schemas in `src/core/accounts/contract.ts` and `src/core/tickets/contract.ts`.
The preload and the main process parse every message with the same schema, so a field that is not in the schema is refused.

The Account channel connects GitHub Accounts through the device flow.
An Account is keyed by the provider's stable user ID, not by the login.
A sign-in as an identity that is already connected renews that Account (`outcome: "renewed"`). A different identity is always a second Account.
The actions are `account.list`, `account.connect`, `account.verify`, `account.await`, `account.cancel`, `account.disconnect`, and `account.dismiss-notice`.
The renderer sees the user code and the verification URL. The device code and the token stay in the main process.
`account.verify` opens the URL that the main process received from GitHub. The renderer cannot name a URL to open.

The grant is sealed with Electron safeStorage in `<userData>/portable-v1/grants.json`.
Account metadata is in `accounts.json` beside it. No message carries a token, and the strict schemas refuse a reply that does.
If GitHub refuses a stored grant, the Account becomes `revoked`. It is not called again until the person reconnects it.
A refusal of a token that a newer sign-in already replaced does not change the Account.
If this computer cannot open a stored grant, the Account reads as `unreadable` until the person reconnects it.
An Account summary lists its Bindings, so a revoked or disconnected Account shows which Projects it affects.
This slice imports no Swift Accounts. Every person sees a one-time notice that asks them to connect GitHub again.

The Ticket channel binds a Project to one repository and reads its open Tickets.
The actions are `ticket.binding`, `ticket.bind`, `ticket.unbind`, and `ticket.list`, and each one carries a `projectId`.
`ticket.bind` also carries an `accountId` and a `scope` (`owner/name`).
The main process asks GitHub whether that Account can read the repository and whether its Issues are on. Only then does it write `bindings.json`.
A Binding stays when its Account is disconnected, revoked, or unreadable. Its summary names that state: `account-missing`, `account-revoked`, or `account-unreadable`.
`ticket.list` returns the open Issues without pull requests. Each Ticket has its title, body, state, labels, type, children, and the Tickets that block it.
`blockedBy` is `null` when GitHub serves no dependency facts for that Ticket. This is different from an empty list.
The error codes and their text are `ACCOUNT_ERRORS` and `TICKET_ERRORS`.
Ticket mutations are #1850 and are not part of this contract.

## Authority and imports

The renderer holds presentation data and named actions only.
The main process owns filesystem, git, process, credential, provider, dialog, browser-opening, and application-lifecycle authority.
The bridge exposes no generic IPC method and accepts no caller-selected storage location.
It refuses new browser windows and renderer-initiated top-level navigation.
Future browser-opening actions must validate their own destinations in the main process.

The proof reads a versioned file with a `projects` array of `{id, path}` records and a `selectedId`.
It requires absolute paths and unique IDs, and projects only the fields this workflow needs.
Other stored fields stay private and are neither forwarded nor rewritten. A registration that
rewrites the file preserves every field it does not own, at the top level and on each record.
Registration establishes that a path is a git root by running git in the main process.
One git root is one Project, so registering a folder inside a registered repository selects that Project.
The `portable-v1` directory separates these files from the Swift store even when both apps resolve the same `userData` directory.

| Data | Owner and import boundary |
| --- | --- |
| Projects and Bindings | Argo owns registrations and validated links. Preserve stable IDs and mutable paths in separate destination files. |
| Account metadata | Argo owns provider identity records. Nothing is imported, and every person connects their Accounts again. |
| Credentials | The main process uses Electron safeStorage under #1824. Never import Swift tokens or send credentials to the renderer. |
| Asserted links | Argo stores only human assertions without a positive external derivation. Preserve their referenced identities. |
| Tickets and Delivery facts | Providers and git remain authoritative. Read through their adapters and rebuild joins. |
| Sessions | CLI transcripts remain authoritative. Observe their files without moving them into an Argo registry. |
| Derived joins and indexes | Rebuildable data only. No new database or persisted source of truth. |

Nothing is imported from the Swift app. Projects, Bindings, and Accounts start fresh in the desktop app.
The Swift reference shapes are `ProjectRegistryStore.swift`, `ProjectRegistry.swift`, and `ProjectRecord+Codable.swift` under `ArgoEngine/Project`.
The Swift reader silently treats corrupt storage as empty. This proof exposes that condition and leaves its recovery UI undecided.

## Decisions that remain with the user

The accepted #1824 spec already records agreement on storage ownership, one-way import, source preservation, and Account reauthentication.
This implementation preserves that agreement and does not introduce another product policy.
The Swift import is descoped, so no recovery or conflict policy for imported records is needed.

Codex process transport belongs to #1826 and has no field in this contract.
The application bridge does not depend on an initialize method inventory or a provider's transport mechanism.
Other operating systems need their own adapter and package evidence before support is claimed.

## Evidence and limits

`project-contract.test.mjs` exercises the application boundary against real isolated files, including actual permission denial.
`project-client.test.mjs` exercises malformed replies and connection failures at the renderer boundary.
Both run through the desktop Bun suite. Focused commands name these individual files.

After packaging arm64, run `bun run prove:project` from `apps/desktop`.
The Playwright proof copies the package and enables only its Node inspector fuse for the test copy.
It uses hidden windows, temporary application storage, and programmatic evaluation without keyboard or mouse control.
It proves success, missing Project, denied access, invalid action, renderer authority, an untrusted document, and unchanged storage.
It then drives the shipped cockpit through registration, a folder that is not a repository, a duplicate folder, a dismissed chooser, a restart, a moved folder, a refused relocation, and one relocation driven by the shipped menu item and another by the control on the refused deck.
It also proves accessible names, a focus ring that every control in the first screen's tab ring draws only while focused, and every navigation chord in the table.
It reads back the original package's production fuses after the run.

`bun run capture:cockpit` writes one PNG per deck state and appearance from the same packaged app.
`bun run measure:cockpit` records startup and idle evidence for #1863 from five launches of it.
Only a run on the 120 Hz reference display is judged. Every other run reports `unjudged` and exits zero.

`bun run test:packaged-tickets` drives the same packaged copy with GitHub replaced by a fake on a loopback port.
The fake is used only when the proof store is set, and only at a `127.0.0.1` origin.
The proof connects an Account, signs in again as the same identity, and connects a second identity.
It makes sure that no token reaches the renderer or an unsealed file.
It binds a repository after one refusal, reads the backlog and one Ticket, and restarts while GitHub is down.
It then reads again, revokes the grant, reconnects, disconnects, and unbinds.
It uses the mock keychain switch, so safeStorage does not use the login keychain of the person who runs it.

The proof reports an unsigned test profile, not signed-release acceptance.
It uses the packaged renderer, preload, and main process, but does not prove an import workflow.
