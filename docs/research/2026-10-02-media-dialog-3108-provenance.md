# MediaDialog composition for #3108

Reviewed baseline: `51d9d7f3696c2a9098876d09e6db58a28faca249`.
The image lightbox catalog entry calls for a named MediaDialog composition under S05, S09,
S10, S12, S14, and S19. Sessions owns this pattern in its renderer facet under ADR-0044.

`media-dialog.tsx` owns explicit backdrop, popup, scrim, controls, and preview recipes.
It uses the installed public Base UI Dialog Backdrop and Popup slots, together with the
registry Portal, Title, and Description. The full-window media layout needs no registry
DialogContent padding, ring, blur, or entry/exit animation. Direct public slot composition
avoids overriding those defaults. There is no private DOM dependency or primitive fork.

The named `MEDIA_DIALOG_SCRIM_COLOR` value is black at 60% alpha in every appearance.
This is the catalog's S14 media scrim exception. It overlays content to isolate a preview.
It does not change the opaque pane, chrome, or ordinary popup rules in ADR-0038.
The named value stays with this domain-only owner; there is no new global theme role.
The existing shared lightbox inset values remain the media bounds contract.
The preview uses automatic width and height so its outer bounds keep the intrinsic aspect ratio
when either viewport limit constrains it.

The registry Dialog source remains unchanged. Its selected `base-nova` provenance,
CLI version, payload and transformed-source hashes, targets, dependencies, and generation
transforms are recorded in [the #3106 candidate record](2026-10-02-shadcn-3106-provenance.md).
No registry item or supporting file was fetched, restored, or changed in #3108.
The removed blur-important override belonged to the old app composition.
The existing thumbnail image classes remain outside this change.

ImageLightbox still owns controlled open state, source capture, load/error callbacks,
trigger attributes, the source ref, and the transition hook. MediaDialog keeps the preview,
controls, and scrim refs and the existing names, title, description, download anchor, and
close actions. Base UI still owns focus entry, the modal tab cycle, Escape, and focus return.
Opening and closing use the same 240ms easing and source bounds. Transform animation leaves
CSS media bounds active after opening, so a resized window can constrain the preview again.
Reduced motion skips both transitions.

The Images stories use real FeedImage loading and error handling. They cover closed,
loading, unavailable, mixed gallery, portrait, landscape, compact thumbnail, close button,
scrim close, download activation, keyboard tab cycling and Escape, repeated opening, and
reduced motion. The download play prevents the actual browser save after checking anchor
attributes and activation. It does not verify filesystem output. The reduced-motion story
answers only the motion query and restores it when the story ends.

Stories inherit the required accessibility check and the Theme and Mode toolbar controls.
They add no appearance copies or forced globals. Plays assert behavior and semantics;
layout measurements belong to live review or the existing styling browser contracts.
Portrait and landscape stories remain open for review at narrow and wide viewport sizes.

## Reviewed checkpoint

All 13 final Images stories completed their plays and passed the required axe scan in the
implementation check. The independent reviewer repeated all 13 through the existing Light
toolbar control and confirmed the same result. The temporary runner required the `played`
phase and rejected play, render, and unhandled error events; render success alone was discarded
as insufficient proof. Biome, all five TypeScript configurations, and the diff whitespace check passed.

Independent live review checked portrait and landscape at 1200 by 800 and 680 by 520 pixels,
including settled-open resizing in both directions. Both images kept their intrinsic proportions
and stayed within the viewport. The 240ms opening animation started at the source bounds;
closing reversed toward the source and returned focus. A representative Light preview kept
the same black scrim and readable controls. Review found no unresolved defect after the portrait
sizing and story timing corrections. Temporary captures and browser sessions were removed.

Verification used Chromium and the worktree Storybook. It did not cover packaged Electron,
actual filesystem download output, a native system motion preference change, every color
Theme, or other browsers. No generated primitive, global color role, or dependency changed.
