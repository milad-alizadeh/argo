import SwiftUI

/// A `mermaid` fence, drawn. ONE view for every diagram type there will ever be: it draws a plan,
/// and a plan knows nothing about what read it (#859).
///
/// The figures are a canvas and the captions are real `Text` — selectable, and set at the very
/// prose metrics the paragraphs around them were measured with, so a diagram sets at the feed's
/// rhythm rather than at a scale of its own.
///
/// A diagram wider than the prose column SCROLLS. Shrinking it to fit would take the words down
/// with it, and a diagram is drawn at the reading size of the message it is in or it is not worth
/// drawing; clipping it would hide half a graph with nothing saying so.
struct MermaidView: View {
    @Environment(\.argo) private var argo

    let diagram: MermaidDiagram

    var body: some View {
        let ink = MermaidInk(palette: argo.color)
        ScrollView(.horizontal) {
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
        }
        .scrollIndicators(.automatic)
        // The plan's own height, which the lane reports for the very same block. A `ScrollView`
        // takes every point it is offered on both axes otherwise, and the row would stand at the
        // height of the deck rather than at the height of the diagram.
        .frame(height: ProseReading.plan(of: diagram).size.height)
    }

    /// The plan's own marks, under its words. The canvas is laid out AT the plan's size, so what it
    /// draws and what the layout placed come from one cached plan rather than two.
    private func figures(_ ink: MermaidInk) -> some View {
        Canvas { context, _ in
            MainActor.assumeIsolated {
                MermaidDrawing(plan: ProseReading.plan(of: diagram), ink: ink).draw(in: &context)
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

// Every shape mermaid spells, so each is looked at beside the others it has to be told from.
#Preview("Mermaid — the node shapes") {
    MermaidPreview(source: """
    graph TD
    A[Rect] --> B(Rounded)
    B --> C([Stadium])
    C --> D[[Subroutine]]
    D --> E{Decision}
    E --> F{{Hexagon}}
    F --> G((Circle))
    G --> H>Flag]
    H --> I[(Store)]
    """)
}

// The four link kinds and both spellings of a word on one, which is the pair a reader has to be
// able to tell apart at a glance.
#Preview("Mermaid — the link kinds") {
    MermaidPreview(source: """
    flowchart LR
    A -->|yes| B
    A -.-> C
    A == thick ==> D
    A --- E
    """)
}

#Preview("Mermaid — a subgraph") {
    MermaidPreview(source: """
    graph TD
    subgraph Reading
    Source --> Model
    end
    Model --> Plan
    """)
}

// A rank of four, which is where a diagram first has to decide what to do about the column.
#Preview("Mermaid — wider than the measure") {
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

#Preview("Mermaid — a sequence") {
    MermaidPreview(source: """
    sequenceDiagram
      actor Dev
      participant Argo
      participant CI as The runner
      Dev->>Argo: implement 862
      Argo->>CI: open the PR
      CI-->>Argo: checks green
    """)
}

// Every arrow form on one screen, which is the set a reader has to be able to tell apart.
#Preview("Mermaid — the arrow forms") {
    MermaidPreview(source: """
    sequenceDiagram
      A->B: plain
      A-->B: dotted
      A->>B: solid head
      A-->>B: dotted head
      A-)B: async
      A-xB: lost
    """)
}

// A run inside a run, a self-message, and a note in each of the three placements.
#Preview("Mermaid — activations and notes") {
    MermaidPreview(source: """
    sequenceDiagram
      Note left of Reader: a fence arrives
      Reader->>+Layout: the model
      Layout->>Layout: rank the nodes
      Note over Layout: measured at the feed's metrics
      Layout-->>-Reader: the plan
      Note right of Reader: drawn
    """)
}

#Preview("Mermaid — nested blocks") {
    MermaidPreview(source: """
    sequenceDiagram
      alt findings
        Review->>Author: changes requested
        loop until clean
          Author->>Review: another push
        end
      else approved
        Review->>Land: merge it
      end
    """)
}

#Preview("Mermaid — a pie") {
    MermaidPreview(source: """
    pie showData title Where the week went
      "Reading the ticket" : 42.5
      "Writing the code" : 31
      "Waiting on CI" : 18.25
      "Reviewing" : 15
    """)
}

// Every hue of the series run at once, which is the set two adjacent wedges have to be told apart
// from — and the ninth slice, which wraps to the first.
#Preview("Mermaid — the series run, and past its end") {
    MermaidPreview(source: """
    pie
      "One" : 1
      "Two" : 1
      "Three" : 1
      "Four" : 1
      "Five" : 1
      "Six" : 1
      "Seven" : 1
      "Eight" : 1
      "Nine" : 1
    """)
}

// The two the arithmetic has to survive: one slice, and a chart worth nothing at all.
#Preview("Mermaid — one slice, and none") {
    VStack(alignment: .leading) {
        MermaidPreview(source: "pie\n  \"The only thing that happened\" : 1")
        MermaidPreview(source: "pie\n  \"Read\" : 0\n  \"Write\" : 0")
    }
}
#Preview("Mermaid — a state machine") {
    MermaidPreview(source: """
    stateDiagram-v2
      [*] --> Reading
      Reading --> Building : agreed
      state "Waiting for CI" as wait
      Building --> wait
      wait --> [*] : green
      note right of wait : the runner holds it
    """)
}

// A composite with its own start, and the choice and fork figures beside each other.
#Preview("Mermaid — composites and pseudo-states") {
    MermaidPreview(source: """
    stateDiagram-v2
      [*] --> Working
      state Working {
        [*] --> Reading
        Reading --> Writing
      }
      state pick <<choice>>
      Working --> pick
      pick --> Landed
      pick --> Working
    """)
}
