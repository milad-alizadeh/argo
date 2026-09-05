import ArgoDesign
import SwiftUI

/// The reading with nothing open in it (#1155, the approved design's `#read .idle`).
///
/// The region is PERMANENT and keeps its height whether a file is open or not, which is what this
/// view is for: a panel that appeared and vanished with what was picked would move the list above
/// it on every click, and a reader choosing from a list they are also scrolling would lose their
/// place each time they chose.
///
/// It says the two ways in and the one way out, and nothing else. There is no chrome here
/// describing its own mechanism — the panel that replaces this one says what it is showing.
public struct AtlasReadingIdle: View {
    @Environment(\.argo) private var argo

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.snug) {
            // The verb carries the weight, because the sentence is an instruction and the reader
            // is looking for what to DO rather than reading a paragraph.
            Text("**Click** a box on the map, or a row in the list, to open it here.")
                .foregroundStyle(argo.color.text.secondary)
            HStack(spacing: ArgoSpacing.snug) {
                key("Esc")
                Text("closes it again.")
            }
        }
        .argoText(ArgoTypography.body)
        .foregroundStyle(argo.color.text.tertiary)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, ArgoSpacing.loose)
        .padding(.vertical, ArgoSpacing.comfortable)
        .accessibilityElement(children: .combine)
    }

    /// A key drawn as the thing you press. `marked` is the contract's ground for a run of machine
    /// text set inside prose, which is what a key's name is, and it is the one ground specified to
    /// keep its lift on whatever it lands on.
    private func key(_ name: String) -> some View {
        Text(name)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, ArgoSpacing.tight)
            .padding(.vertical, ArgoSpacing.hair)
            .background(argo.color.surface.marked, in: .rect(cornerRadius: ArgoRadius.marker))
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .strokeBorder(argo.color.edge.strong.color, lineWidth: ArgoStroke.border)
            }
    }
}

#Preview("Atlas reading — nothing open") {
    AtlasReadingIdle()
        .frame(width: 356, height: 322)
        .argoAppearance()
}
