# #3104 registry restoration and app search compositions

The work uses the shared worktree on `argo/#3101-saved-theme-appearance`.
The [candidate record](2026-10-02-shadcn-3104-candidates.json) records the fetched payloads, CLI source identities, installed source identities, dependencies, targets, and transforms.
The installed `shadcn@4.21.0` CLI generated the selected `base-nova` candidates in read-only preview mode.
Only Command, InputGroup, and Combobox were restored. No supporting registry dependency was overwritten.

## Decisions

SearchField owns the inline search surface outside registry source.
SidebarSearch keeps its controlled value, change callback, accessible label, and maximum length.
SearchField preserves native InputGroup and Input typography, geometry, disabled behavior, and invalid treatment.

CommandSearchField composes the public cmdk Input with registry InputGroup slots.
Registry CommandInput exposes input attributes but no public wrapper appearance slot.
The app composition supplies the inline surface without selecting private descendants or changing the registry source.
SearchablePickerItem applies the app selected color through CommandItem's public className.
The raw Command keeps the selected registry color and input treatment.

SearchablePickerInput composes public Base UI Combobox Input, registry InputGroup slots, and ComboboxTrigger.
It owns the existing localized pointer-trigger label and removes that trigger from the keyboard tab order.
The input keeps arrow navigation, filtering, selection, Escape, refs, and forwarded attributes.
SourceField keeps its label, error descriptions, controlled object selection, and discovery behavior.
A wrapper solely for full-width layout was not added.

WorkspaceMenu uses the existing native menu trigger appearance to remove its translucent and blurred workspace surface.
It keeps workspace selection, popup dimensions, list scrolling, opening direction, failure feedback, and focus return with their existing owners.
The shared DropdownTrigger implementation was not edited.
The optional disabled input is forwarded to its existing public trigger.

The raw Command empty fixture supplies a disabled option in CommandEmpty.
This satisfies the empty listbox's accessibility contract through public composition.
No registry fork or axe exemption was added.

## Focused proof

The following stories use their owning component or domain files.
Light and Dark use the existing Mode global. Default is the selected color theme.
Behavior stays in play functions. The existing required Storybook axe scan supplies accessibility proof.
There are no added style unit tests, computed-CSS tests, or duplicate mode exports.

| Story | Light | Dark |
| --- | --- | --- |
| Components/Combobox / Raw | [Light](http://localhost:6007/?path=/story/components-combobox--raw&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-combobox--raw&globals=theme:dark;themeIdentity:default) |
| Components/Combobox / Empty | [Light](http://localhost:6007/?path=/story/components-combobox--empty&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-combobox--empty&globals=theme:dark;themeIdentity:default) |
| Components/Combobox / Selected | [Light](http://localhost:6007/?path=/story/components-combobox--selected&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-combobox--selected&globals=theme:dark;themeIdentity:default) |
| Components/Combobox / Disabled | [Light](http://localhost:6007/?path=/story/components-combobox--disabled&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-combobox--disabled&globals=theme:dark;themeIdentity:default) |
| Components/Combobox / Invalid | [Light](http://localhost:6007/?path=/story/components-combobox--invalid&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-combobox--invalid&globals=theme:dark;themeIdentity:default) |
| Components/Combobox / Long Option Narrow | [Light](http://localhost:6007/?path=/story/components-combobox--long-option-narrow&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-combobox--long-option-narrow&globals=theme:dark;themeIdentity:default) |
| Components/Command / Raw | [Light](http://localhost:6007/?path=/story/components-command--raw&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-command--raw&globals=theme:dark;themeIdentity:default) |
| Components/Command / Empty | [Light](http://localhost:6007/?path=/story/components-command--empty&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-command--empty&globals=theme:dark;themeIdentity:default) |
| Components/Command / Selected | [Light](http://localhost:6007/?path=/story/components-command--selected&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-command--selected&globals=theme:dark;themeIdentity:default) |
| Components/Command / Disabled | [Light](http://localhost:6007/?path=/story/components-command--disabled&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-command--disabled&globals=theme:dark;themeIdentity:default) |
| Components/Command / Invalid | [Light](http://localhost:6007/?path=/story/components-command--invalid&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-command--invalid&globals=theme:dark;themeIdentity:default) |
| Components/Command / Long Option Narrow | [Light](http://localhost:6007/?path=/story/components-command--long-option-narrow&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-command--long-option-narrow&globals=theme:dark;themeIdentity:default) |
| Components/Search Field / Search | [Light](http://localhost:6007/?path=/story/components-search-field--search&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-search-field--search&globals=theme:dark;themeIdentity:default) |
| Components/Search Field / Disabled | [Light](http://localhost:6007/?path=/story/components-search-field--disabled&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-search-field--disabled&globals=theme:dark;themeIdentity:default) |
| Components/Search Field / Invalid | [Light](http://localhost:6007/?path=/story/components-search-field--invalid&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-search-field--invalid&globals=theme:dark;themeIdentity:default) |
| Components/Input Group / Raw | [Light](http://localhost:6007/?path=/story/components-input-group--raw&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-input-group--raw&globals=theme:dark;themeIdentity:default) |
| Components/Input Group / Populated | [Light](http://localhost:6007/?path=/story/components-input-group--populated&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-input-group--populated&globals=theme:dark;themeIdentity:default) |
| Components/Input Group / Disabled | [Light](http://localhost:6007/?path=/story/components-input-group--disabled&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-input-group--disabled&globals=theme:dark;themeIdentity:default) |
| Components/Input Group / Invalid | [Light](http://localhost:6007/?path=/story/components-input-group--invalid&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-input-group--invalid&globals=theme:dark;themeIdentity:default) |
| Components/Sidebar Search / Search | [Light](http://localhost:6007/?path=/story/components-sidebar-search--search&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-sidebar-search--search&globals=theme:dark;themeIdentity:default) |
| Components/Sidebar Search / Populated | [Light](http://localhost:6007/?path=/story/components-sidebar-search--populated&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-sidebar-search--populated&globals=theme:dark;themeIdentity:default) |
| Components/Sidebar Search / Empty Query | [Light](http://localhost:6007/?path=/story/components-sidebar-search--empty-query&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-sidebar-search--empty-query&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / Workspace Picker | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--workspace-picker&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--workspace-picker&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / Main Checkout | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--main-checkout&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--main-checkout&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / No Matches | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--no-matches&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--no-matches&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / Keyboard Selection And Focus Return | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--keyboard-selection-and-focus-return&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--keyboard-selection-and-focus-return&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / Disabled | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--disabled&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--disabled&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / No Existing Workspaces | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--no-existing-workspaces&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--no-existing-workspaces&globals=theme:dark;themeIdentity:default) |
| Sessions/Composer/Workspace Menu / Long Option Narrow Popup | [Light](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--long-option-narrow-popup&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/sessions-composer-workspace-menu--long-option-narrow-popup&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Connect Repository | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--connect-repository&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--connect-repository&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / No Match | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--no-match&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--no-match&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Keyboard Order | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--keyboard-order&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--keyboard-order&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Switch Account | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--switch-account&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--switch-account&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Reading Repositories | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--reading-repositories&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--reading-repositories&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / No Repositories | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--no-repositories&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--no-repositories&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Repositories Unreadable | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--repositories-unreadable&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--repositories-unreadable&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Checking | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--checking&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--checking&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Repository Refused | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--repository-refused&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--repository-refused&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / No Account | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--no-account&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--no-account&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Connect Source Form / Connect Team | [Light](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--connect-team&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-connect-source-form--connect-team&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / Picker | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--picker&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--picker&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / Empty Results | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--empty-results&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--empty-results&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / No Sources | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--no-sources&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--no-sources&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / Selected | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--selected&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--selected&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / Disabled | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--disabled&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--disabled&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / Invalid | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--invalid&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--invalid&globals=theme:dark;themeIdentity:default) |
| Tickets/Connection/Source Field / Long Option Narrow | [Light](http://localhost:6007/?path=/story/tickets-connection-source-field--long-option-narrow&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/tickets-connection-source-field--long-option-narrow&globals=theme:dark;themeIdentity:default) |
| Components/Dropdown Trigger / Label Search | [Light](http://localhost:6007/?path=/story/components-dropdown-trigger--label-search&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-dropdown-trigger--label-search&globals=theme:dark;themeIdentity:default) |
| Components/Dropdown Trigger / Icon Search | [Light](http://localhost:6007/?path=/story/components-dropdown-trigger--icon-search&globals=theme:light;themeIdentity:default) | [Dark](http://localhost:6007/?path=/story/components-dropdown-trigger--icon-search&globals=theme:dark;themeIdentity:default) |

## Check limits

The [live check record](2026-10-02-shadcn-3104-story-checks.json) records 49 passing stories in each Mode.
All 98 recorded play checks and all 98 existing required axe scans passed with zero violations.
The live completion reports also confirm the expected Light or Dark appearance.
Scoped Biome checks passed for all 12 app and story files.
All three installed registry files match the normalized CLI candidates and their recorded SHA-256 identities.
The standard Vitest Storybook runner fails before importing tests because linked dependency setup modules resolve through the primary checkout.
An isolated scratch path correction reached the setup module but failed on its bare `vitest` import.
Shared Storybook and Vitest configuration remain unchanged.

The renderer type check reports duplicate React ref identities in existing Input and StatusBadge source.
The check also reported the removed `appearance` prop in `components/dropdown-trigger.stories.tsx`.
The shared-story migration subsequently removed that stale prop.
Both affected search stories passed play and axe checks in Light and Dark.
The full renderer type check was not repeated after that migration.
The three new source identities remain in this ticket's separate candidate record until the coordinator updates the shared registry baseline.

Port 6007 originally served a different worktree.
It now serves this shared worktree from the repository's existing Storybook configuration.
Native Electron, System appearance, theme persistence, popup measurement contracts, the full quality gate, and independent review were not run in this slice.

## Shared owner handoff

The coordinator handed off the prepared DropdownTrigger story migration.
The story now uses CommandSearchField and SearchablePickerItem.
Its search play checks filtering and focus return through visible controls.
Both Label Search and Icon Search passed play and required axe checks in Light and Dark on port 6007.
No other chat was messaged during the handoff.

## Canvas cleanup

Command and SourceField no longer render selected-value mirrors.
SourceField no longer renders a test-only Continue button.
SidebarSearch no longer renders a fabricated results list or test-only no-results message.
The field's empty state is now Empty Query.
Selection and change assertions use Storybook spies, input values, and accessible selection state inside play functions.
All 34 focused play and axe checks after cleanup passed in Light and Dark with zero violations.
Unchanged story checks remain in the same live record alongside these latest results.
The real ConnectSourceForm Keyboard Order story proves focus moves from the field to its actual submit button.
The remaining owned Combobox, InputGroup, SearchField, DropdownTrigger, and WorkspaceMenu stories contain no visible event logs or assertion scaffolding.

## Missing workspace choice

The unavailable-choice fixture was removed at the user’s request.
Workspace listing now resolves a removed saved choice to the main checkout.
The renderer also resolves a stale optimistic choice to main and reports only actual save failures.
The initial New worktree choice is preserved.
The existing Node workspace API suite passed all three tests, including selection and removal of a real Git worktree.
The four affected source files passed scoped Biome checks.
All 14 remaining WorkspaceMenu play and required axe checks passed in Light and Dark with zero violations.

## Changed sources

Production owners in this slice:

- `apps/desktop/src/platform/renderer/components/ui/command.tsx`
- `apps/desktop/src/platform/renderer/components/ui/input-group.tsx`
- `apps/desktop/src/platform/renderer/components/ui/combobox.tsx`
- `apps/desktop/src/platform/renderer/components/design-system/search-field.tsx`
- `apps/desktop/src/platform/renderer/components/design-system/searchable-picker.tsx`
- `apps/desktop/src/platform/renderer/components/sidebar-search.tsx`
- `apps/desktop/src/domains/sessions/renderer/composer/toolbar/workspace-menu.tsx`
- `apps/desktop/src/domains/workspaces/main/api/workspace-list.ts`
- `apps/desktop/src/domains/workspaces/renderer/use-workspaces.ts`
- `apps/desktop/src/domains/tickets/renderer/connection/source-field.tsx`

Stories are beside the listed component or domain owners.
Raw registry stories live in `components/command.stories.tsx`, `components/input-group.stories.tsx`, and `components/combobox.stories.tsx`.
SearchField, SidebarSearch, WorkspaceMenu, and SourceField each have an owning story file.
Existing ConnectSourceForm stories were exercised without source changes.
All changes remain uncommitted. No files were staged, pushed, or independently reviewed.
