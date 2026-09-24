# #2694 demolition manifest

Integration branch: `argo/#2694-remove-retired-paths`

Worktree: `.claude/worktrees/ticket-2694-remove-retired-paths`

Base: `9c79d72a4` (`Specify rewrite recovery and sync ownership boundaries`)

This manifest records the old request surface, its replacement owner, and the boundaries that
remain during the rewrite. The app can fail to build until #2587 completes the cutover.

## Request operation inventory

| Domain and operations | Replacement owner |
| --- | --- |
| Session: `start` | #2687 |
| Session: `list` | #2688, #2696 |
| Session: `feed` | #2690, #2697 |
| Session: `cancelFeed`, `send`, `interrupt`, `readPermission`, `decidePermission`, `decideQuestion` | #2702 |
| Session: `rename` | #2700 |
| Session: `steer`, `handoff`, `shellOutput`, `subagentUsage` | #2714 |
| Session: `compact` | #2710 |
| Session: `chooseAttachments`, `statAttachments`, `file`, `skill` | #2713 |
| Session: `connectTicket`, `disconnectTicket` | #2704 |
| Session: `archiveList`, `archiveSet`, `focusUnread` | #2712 |
| Session: `search` | #2586, #2701 |
| Ticket: `connection`, `connect`, `disconnect`, `discover` | #2707, #2689, #2703 |
| Ticket: `list` | #2689, #2703 |
| Ticket: `update`, `priority` | #2705, #2706 |
| Account: `list`, `connect`, `verify`, `await`, `cancel`, `dismissNotice`, `disconnect` | #2707 |
| Project: `open`, `list`, `register`, `relocate`, `select` | #2708 |
| Workspace: `workspaceList`, `workspaceSelect`, `workspaceCreateManaged` | #2708 |
| ProjectSetup: `setupCommand`, `setupSnapshot` | #2709 |
| Harness sign-in: `list`, `start`, `wait`, `cancel` | #2710 |
| Codex compaction: `get`, `set` | #2710 |
| Managed Session: `command`, `subscribe`, `catalog` | #2693, #2702, #2714 |
| Platform appearance: `get`, `set` | #2711 |

The Session entries are the complete `SESSION_OPERATIONS` table and its archive, search, read,
and unread spreads. The other entries are the complete named operation tables under Accounts,
Projects, Tickets, Harness sign-in, managed Sessions, Codex compaction, and Appearance. The
remaining platform methods (`zoomFactor`, `pathForFile`, version and development identity) also
move with platform requests in #2711.

## Kept boundaries and owners

| Boundary | Kept owner |
| --- | --- |
| Claude managed Session actor and SDK adapter | Claude Harness; #2687, #2698, #2702 |
| Codex app-server supervisor and managed Session child actors | Codex Harness; #2687, #2699, #2702 |
| Claude and Codex vendor history interfaces | Harness adapters; #2688, #2690, #2696, #2697 |
| Claude SDK list and message history; Codex app-server history read-one and refresh | Harness adapters; #2688, #2690, #2696, #2697 |
| Claude transcript envelope parser and recorded producer corpus | Claude Harness; #2684, #2690, #2697 |
| ProjectSetup durable actor | Project domain; #2709 |
| Account provider sign-in actor and Harness sign-in actors | Account and Harness sign-in domains; #2707, #2710 |
| Supported GitHub and Linear provider adapters | Provider modules; #2689, #2703, #2715, #2716 |
| Ticket observer actor | No actor exists at this base. Build one per Connection in #2689 and #2703; read-one behavior belongs to #2715 and #2716. |
| `argo:managed-session:projection` event contract | Managed Session adapter; #2702 |
| Named `argo:project:setup:changed` channel | ProjectSetup actor; #2709 |
| Named `argo:watch:changed` channel for Session and Permission invalidation | Watch bridge; Session sync owners #2688 and #2696, managed state #2702 |
| Named `argo:appearance:changed` channel | Appearance state; #2711 |
| Named `argo:command` channel | Application menu commands; #2711 |

The named event contracts remain in preload and their owning domains. The managed projection
producer is inactive until #2693 and #2702 reconnect the adapter to the renderer. Query invalidation
events needed by indexed Session and Ticket reads belong to their replacement slices. Vendor
Session history remains behind the Harness interface. Ticket read-one must distinguish deletion
from access loss and temporary failure.

## Retired paths

Remove vendor-page Roster merging, transcript and rollout file readers, duplicate Ticket list
reads, operation tables and their per-domain preload clients, and renderer hooks that only forward
those calls. Keep the Claude transcript envelope parser as a Harness boundary; it parses SDK and
recorded producer messages and does not discover or read transcript files. Remove the Ticket-link
flow that renames a vendor Session; a linked Ticket title is a display projection owned by #2704.
Remove multiwindow behavior; #2695 establishes one application window and second-launch focus.

Keep durable Argo Session identity and local title, pin, and Ticket-link data. Keep the Session
actors, supported vendor adapters, Ticket provider adapters, ProjectSetup, sign-in actors, and
named live channels listed above. Remove tests only with the retired implementation. Keep focused
behavior tests for retained actors and adapters.

## Known broken flows after demolition

The renderer request surface and old main-process handlers are removed before their tRPC
replacements exist. Session and Ticket pages, Account and Project settings, Workspace actions,
ProjectSetup, sign-in, Appearance, compaction, Session controls, Ticket linking, search, archive,
unread, files, skills, and attachments will not work until their listed slices land. Vendor
history adapters need replacement index types before the old Roster reader can be deleted. Managed
Session adapter code remains, but its composition and projection producer are inactive until #2693
and #2702 reconnect them. The app can remain unbuildable until final cutover #2587.
