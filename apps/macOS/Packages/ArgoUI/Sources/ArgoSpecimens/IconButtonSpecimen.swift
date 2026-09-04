import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// Every ground an icon button takes, at the ONE box they all share, beside the lone-button
/// container derived from it (#1243).
///
/// A sheet of its own as well as a section of the contract's: the contract sheet is longer than any
/// window, so a section near its foot is in no render anybody looks at — and the whole reason the
/// row exists is that four boxes were visible in a screenshot long before anything failed.
struct IconButtonSpecimen: View {
    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            IconButtonRow()
        }
        .padding(ArgoSpacing.region)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .argoDeckSurface()
    }
}

/// The row itself, so the contract sheet and the sheet above draw one thing rather than two that
/// have to be kept in step.
struct IconButtonRow: View {
    @Environment(\.argo) private var argo

    var body: some View {
        HStack(alignment: .center, spacing: ArgoSpacing.loose) {
            ArgoIconButtonGroup {
                SpecimenControl(symbol: ArgoSymbol.openOnHost, label: "Open on host")
                ArgoIconButtonRule()
                SpecimenControl(symbol: ArgoSymbol.copyLink, label: "Copy link")
            }
            // The state the atom spells for every icon button at once: a plain button dims nothing
            // it did not draw, so the ink is the whole of what says so.
            ArgoIconButtonGroup {
                SpecimenControl(symbol: ArgoSymbol.newTicket, label: "New ticket")
                    .disabled(true)
            }
            SpecimenControl(
                symbol: ArgoSymbol.send,
                label: "Send",
                face: ArgoControlFace(
                    ink: argo.color.text.onAccent,
                    ground: .fill(argo.color.interaction.accent),
                ),
            )
            SpecimenControl(
                symbol: ArgoSymbol.newSession,
                label: "New Session",
                face: ArgoControlFace(
                    box: ArgoControlBox.vessel,
                    ink: argo.color.text.primary,
                    ground: .glass,
                ),
            )
            SpecimenControl(
                symbol: ArgoSymbol.latest,
                label: "Newest",
                face: ArgoControlFace(ink: argo.color.text.secondary, ground: .floatingGlass),
            )
            // Two `Text`s and one line: a localized key is a LITERAL, so the halves cannot be
            // joined with `+` inside one and the line will not fit under the wrap.
            (Text("box \(Int(ArgoControlBox.icon), format: .machine) · ")
                + Text("vessel \(Int(ArgoControlBox.vessel), format: .machine)"))
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
        }
    }
}

/// One of the sheet's buttons. Inert, and drawn on the ordinary chrome face unless the caller names
/// the one it is here to show.
private struct SpecimenControl: View {
    @Environment(\.argo) private var argo

    let symbol: String
    let label: String
    var face: ArgoControlFace?

    var body: some View {
        ArgoIconButton(
            symbol,
            voice: ArgoControlVoice(label),
            face: face ?? ArgoControlFace(ink: argo.color.text.tertiary),
            act: {},
        )
    }
}
