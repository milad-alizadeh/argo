import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The leading `+` — the drawer onto files, skills and commands (design decision 11,
/// `cockpit-composer-picker.md`, #689).
///
/// A `+` and not a paperclip: what it opens is "give the agent something", and a paperclip would
/// name only a picker — which this control no longer opens at all. The system panel cannot
/// produce a mention (decision 12), so a file now comes from the SAME in-app Workspace tree `@`
/// already reads; only a drop or a paste still make an `AttachmentChip` (#540).
///
/// **It is absent, never disabled, for a Session offering neither a Workspace nor a command
/// surface** (design decision 9, read by `AddMenu.rows(on:)`). That absence is the caller's —
/// this view exists only where `AddMenu` would have a row, because a control that renders itself
/// away is one whose disabled state somebody will eventually add back.
struct AddButton: View {
    @Environment(\.argo) private var argo

    /// Whether `AddMenu` is the surface currently standing over the vessel.
    let isOpen: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            ArgoGlyph(ArgoSymbol.attach, .control)
                .foregroundStyle(argo.color.text.secondary)
                .frame(
                    width: ArgoComposerVessel.controlDiameter,
                    height: ArgoComposerVessel.controlDiameter,
                )
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .help(AddMenu.label)
        .accessibilityLabel(AddMenu.label)
        .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
    }
}

#Preview("Add button") {
    AddButton(isOpen: false, toggle: {})
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Add button — open") {
    AddButton(isOpen: true, toggle: {})
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
