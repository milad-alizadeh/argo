# #3106 registry candidate record

Fetched 2026-10-02 from the selected `base-nova` built-in registry with the installed
`shadcn@4.21.0` CLI. `apps/desktop/components.json` selects `base-nova`, `cssVariables: true`,
and the Phosphor icon library. The raw item hashes below match the fetch-time records in the
2026-10-01 provenance audit.

The transformed-source hash is SHA-256 of the component body emitted by the CLI's read-only
`add <name> --view <name>.tsx` preview. Only the preview's box framing was removed before hashing.
The CLI resolves registry aliases, replaces registry icon placeholders with the configured
Phosphor imports, and formats the generated TypeScript. The checked-in files were changed surgically
to preserve Argo's import and formatting conventions; unrelated CLI output was not copied.

| Item | Raw payload SHA-256 | Transformed source SHA-256 | Payload dependencies | Declared file target |
| --- | --- | --- | --- | --- |
| `dialog` | `40fc321d25eb9590d07db54b00d9bc1a74274a549aa06d5915a34ba302ed8b94` | `2514dff3e1019eed0d3d7bdac8fe878e05009e42b3e796b6bdd2931e4dbced5d` | `cn` | `registry/base-nova/ui/dialog.tsx` |
| `alert-dialog` | `974543244faee02eb4ea40264b7e0bbda2b01c3f2c369de965d2ac771c57a8af` | `054b2d4ebca281ffe099b84c913e90c02b74e45a03b399d05e10ee254c543b23` | `cn` | `registry/base-nova/ui/alert-dialog.tsx` |
| `card` | `e73e3fe00ab2e14c4db1dccb1ff5c67041a94c0926ac3216c1dc6dd6dee9d7e0` | `728c7cc7b7b5d76541a22d8c5e0b14fba91373f2bb12cbb712bcfa70d6694604` | `cn` | `registry/base-nova/ui/card.tsx` |
| `sheet` | `72b36d92af7fcbc9bd2d1d4ef0cbc65f4fc8178f7bb2bedaf657460f15011cf4` | `6ba12e7106f7dcce9873e9a00b240b9130c7f70117bff2dc10ed99cec0b1718e` | `cn` | `registry/base-nova/ui/sheet.tsx` |
| `drawer` | `fc81c0adadef868df72172c9cf83237b8ab791a4f0f3e300540883be56c26982` | `a1def3e3e59b8155244b0aec532e679ec78379902305c282d98bad1f6ace6918` | `cn`, `@base-ui/react` | `registry/base-nova/ui/drawer.tsx` |

The installed CLI preview resolves `Button` as a supporting import for Dialog and Sheet, but it is
not a declared file target in either payload. No support file was written. The only restored source
differences in this slice are the title classes in AlertDialog, Card, Sheet, and Drawer, plus the
Sheet close icon stroke override. Dialog already matched the selected candidate in this checkout,
including the upstream title, close icon, and absence of an `overlayClassName` API. `ImageLightbox`
continues to compose `DialogPortal`, `DialogOverlay`, and Base UI `DialogPrimitive.Popup` directly.

## Design decisions

- Keep each registry title at the selected `base-nova` default. Product titles use their named
  owner instead of a global heading override.
- Keep project name and path presentation in `ProjectSettingsDescription`; retain popup width and
  scrolling in `ProjectSettingsDialog`.
- Use the shared `FieldError` for rename validation while keeping the existing input, focus, and
  described-by relationship.
- Keep `ImageLightbox` geometry and transitions in its existing app-owned composition. #3108 owns
  the media geometry proof.
