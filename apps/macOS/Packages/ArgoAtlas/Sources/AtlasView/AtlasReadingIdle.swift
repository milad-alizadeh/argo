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
            Text(opening)
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

    /// The instruction, with the verb lifted one rung out of the prose around it.
    ///
    /// The rung AND the weight, never the weight alone: the sentence is an instruction, the reader
    /// is looking for what to DO, and a bold word set in the same ink as the words beside it is a
    /// word that has to be found by reading. Built as an attributed run rather than markdown
    /// emphasis, which carries a weight and cannot carry an ink.
    private var opening: AttributedString {
        var line = AttributedString(
            "Click a box on the map, or a row in the list, to open it here.",
        )
        if let verb = line.range(of: "Click") {
            line[verb].inlinePresentationIntent = .stronglyEmphasized
            line[verb].foregroundColor = argo.color.text.secondary.color
        }
        return line
    }

    /// A key drawn as the thing you press. `marked` is the contract's ground for a run of machine
    /// text set inside prose, which is what a key's name is, and it is the one ground specified to
    /// keep its lift on whatever it lands on.
    private func key(_ name: String) -> some View {
        Text(name)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.primary)
            // Flush on the vertical, which is the design's own padding for a key: the ground is
            // the line box the name is set in, and anything added to it makes a key taller than
            // the sentence it sits in.
            .padding(.horizontal, ArgoSpacing.tight)
            .padding(.vertical, ArgoSpacing.flush)
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
