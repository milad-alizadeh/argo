import ArgoDesign
import AtlasLayout
import SwiftUI

/// What is left off the map, and what is drawn over it (#1161, #1160). The design's `AtlasFilters`
/// section, both rows.
///
/// Hiding test files re-reads the repository without them, so the ranges move with the set: the
/// legend beside this says what the colour is worth over the files that are actually drawn — and
/// the ties go with them, because a cord to a file the map is not drawing has no box to end on.
public struct AtlasFilters: View {
    @Environment(\.argo) private var argo

    @Binding private var hideTests: Bool
    @Binding private var showTies: Bool

    public init(hideTests: Binding<Bool>, showTies: Binding<Bool>) {
        _hideTests = hideTests
        _showTies = showTies
    }

    public var body: some View {
        AtlasSidebarSection("Filters") {
            AtlasFilterSwitch(
                label: "Hide test files",
                help: "Drop test files and re-read the repository without them",
                isOn: $hideTests,
            )
            AtlasFilterSwitch(
                label: "Strongest ties",
                help: "The file pairs that keep changing in the same commit",
                isOn: $showTies,
            )
            cap
        }
    }

    /// **The cap is stated rather than hidden.** This repository counts 18,402 ties and the map
    /// draws a hundred and sixty of them, so a switch labelled "Strongest ties" and nothing else
    /// would be a picture making a claim about the repository it cannot keep — a reader counting
    /// cords would be counting the drawing's own limit and reading it as the history.
    ///
    /// Read off `AtlasCoupling.cap` rather than typed, so the number under the switch cannot come
    /// to differ from the number the drawing uses.
    private var cap: some View {
        Text("the strongest \(AtlasCoupling.cap), one line per pair")
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel(
                "Strongest ties draws the strongest \(AtlasCoupling.cap) pairs, one line each",
            )
    }
}

/// One filter: what it is called, what it does, and the switch that sets it.
///
/// The platform's own switch: a boolean is a switch, and a shape with a tap gesture is a control
/// that can look right and fire nothing (`rules/swift.md`).
private struct AtlasFilterSwitch: View {
    let label: String
    let help: String
    @Binding var isOn: Bool

    var body: some View {
        AtlasSidebarRow(label) {
            Toggle(label, isOn: $isOn)
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
                .help(help)
        }
    }
}
