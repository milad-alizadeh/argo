import SwiftUI

/// A `mermaid` fence, drawn. ONE view for every diagram type there will ever be: it draws a plan,
/// and a plan knows nothing about what read it (#859).
///
/// The figures are a canvas and the captions are real `Text` — selectable, and set at the very
/// prose metrics the paragraphs around them were measured with, so a diagram sets at the feed's
/// rhythm rather than at a scale of its own.
struct MermaidView: View {
    @Environment(\.argo) private var argo

    let diagram: MermaidDiagram

    var body: some View {
        let ink = MermaidInk(palette: argo.color)
        MermaidLayout(diagram: diagram) {
            ForEach(Array(diagram.labels.enumerated()), id: \.offset) { _, label in
                Text(label.text)
                    .argoText(label.face.rung, label.face.isBold ? .semibold : nil)
                    .foregroundStyle(ink.words(of: label.role))
                    .multilineTextAlignment(.center)
                    .textSelection(.enabled)
            }
        }
        .background { figures(ink) }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The plan's own marks, under its words. The canvas is laid out AT the plan's size, so the
    /// width it reports back is the width the plan was made at — the same cached layout, not a
    /// second one.
    private func figures(_ ink: MermaidInk) -> some View {
        Canvas { context, size in
            MainActor.assumeIsolated {
                MermaidDrawing(plan: ProseReading.plan(of: diagram, across: size.width), ink: ink)
                    .draw(in: &context)
            }
        }
    }
}

/// The states this view can be in, each on the measure the feed reads at. A fence it cannot read
/// never reaches here — `MarkdownBlock` leaves that one a `.fenced`, drawn by `FeedMarkdownFence`.
private struct MermaidPreview: View {
    let source: String

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.blockStep) {
            if let diagram = MermaidDiagram.read(source) {
                MermaidView(diagram: diagram)
            }
        }
        .padding(ArgoFeedRow.inset)
        .frame(width: 620)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Mermaid — a flowchart the agent drew") {
    MermaidPreview(source: "graph TD\nReader --> Layout\nLayout --> Plan")
}

// A rank of four, which is where a diagram first has to decide what to do about the column.
#Preview("Mermaid — a fork wider than the measure") {
    MermaidPreview(source: """
    graph TD
    Plan --> AVeryLongNodeName
    Plan --> AnotherLongNodeName
    Plan --> AThirdLongNodeName
    Plan --> AFourthLongNodeName
    """)
}

// A source somebody really writes: it settles at two ranks rather than ranking for ever.
#Preview("Mermaid — a cycle") {
    MermaidPreview(source: "graph TD\nRead --> Write\nWrite --> Read")
}
