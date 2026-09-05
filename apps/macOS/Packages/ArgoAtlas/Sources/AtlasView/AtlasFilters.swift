import ArgoDesign
import SwiftUI

/// What is left off the map (#1161). The design's `AtlasFilters` section, scoped to the one filter
/// this ticket wires — Strongest ties is #1160's row of the same section.
///
/// Hiding test files re-reads the repository without them, so the ranges move with the set: the
/// legend beside this says what the colour is worth over the files that are actually drawn.
public struct AtlasFilters: View {
    @Binding private var hideTests: Bool

    public init(hideTests: Binding<Bool>) {
        _hideTests = hideTests
    }

    public var body: some View {
        AtlasSidebarSection("Filters") {
            AtlasSidebarRow("Hide test files") {
                // The platform's own switch: a boolean is a switch, and a shape with a tap
                // gesture is a control that can look right and fire nothing (`rules/swift.md`).
                Toggle("Hide test files", isOn: $hideTests)
                    .labelsHidden()
                    .toggleStyle(.switch)
                    .controlSize(.small)
                    .help("Drop test files and re-read the repository without them")
            }
        }
    }
}
