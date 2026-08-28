@testable import ArgoUI
import Foundation
import Testing

/// Where a read mindmap is placed. The claims are the ones a reader would make with their eyes on
/// it: nothing drawn over anything else, branches on both sides of the root, and a child standing
/// further out than the parent it hangs from.
@MainActor
@Suite("Mermaid mindmap layout")
struct MermaidMindmapLayoutTests {
    private static func plan(_ source: String) -> MermaidPlan {
        MermaidDiagram.read(source)?.laid ?? .empty
    }

    /// Several branches and three levels — the shape the ticket asks a specimen to show, so the
    /// suite argues about the diagram somebody actually looks at.
    private static let source = """
    mindmap
      root((Argo))
        Reading
          Source
          Model
        Layout
          Ranks
          Routes
        Drawing
          Canvas
          Captions
    """

    private static func boxes(of plan: MermaidPlan) -> [CGRect] {
        plan.figures.compactMap { figure in
            guard case let .shape(_, rect) = figure.form else { return nil }
            return rect
        }
    }

    @Test
    func `no two nodes overlap`() {
        let boxes = Self.boxes(of: Self.plan(Self.source))

        #expect(boxes.count == 10)
        for (at, box) in boxes.enumerated() {
            for other in boxes[(at + 1)...] {
                #expect(!box.intersects(other))
            }
        }
    }

    /// A mindmap reads as a map rather than as a list: the root's own branches go round it, so at
    /// least one of them stands each side of the centre.
    @Test
    func `the root's branches stand on both sides of it`() {
        let plan = Self.plan(Self.source)
        let root = Self.boxes(of: plan).first

        #expect(root.map { root in
            let branches = plan.captions
                .filter { ["Reading", "Layout", "Drawing"].contains($0.label.text) }
            return branches.contains { $0.rect.maxX < root.minX }
                && branches.contains { $0.rect.minX > root.maxX }
        } == true)
    }

    /// Depth is legible because it is DISTANCE: a child stands further from the centre than its
    /// parent, whichever side of the map it fell on.
    @Test
    func `a child stands further out than its parent`() {
        let plan = Self.plan(Self.source)
        let placed = Dictionary(
            uniqueKeysWithValues: plan.captions.map { ($0.label.text, $0.rect) },
        )
        let centre = placed["Argo"]?.midX ?? 0

        for (parent, child) in [("Reading", "Source"), ("Layout", "Routes"), (
            "Drawing",
            "Canvas",
        )] {
            let reach = { (rect: CGRect?) in abs((rect?.midX ?? 0) - centre) }
            #expect(reach(placed[child]) > reach(placed[parent]))
        }
    }

    /// The pairing the view rests on: it builds one `Text` per label and places it on the caption
    /// at the same index.
    @Test
    func `one caption per label, in that order`() {
        let diagram = MermaidDiagram.read(Self.source)

        #expect(diagram?.laid.captions.map(\.label) == diagram?.labels)
    }

    @Test
    func `the same mindmap lays out the same way twice`() {
        #expect(Self.plan(Self.source) == Self.plan(Self.source))
    }

    /// A map of one node is a map: one box, and room enough to draw it in.
    @Test
    func `a lone root is drawn on its own`() {
        let plan = Self.plan("mindmap\n  Argo")

        #expect(Self.boxes(of: plan).count == 1)
        #expect(plan.size.width > 0 && plan.size.height > 0)
    }

    /// A node set over two lines takes the room for two, or the second line is drawn over the
    /// neighbour under it.
    @Test
    func `a node set over two lines stands taller than one`() {
        let one = Self.plan("mindmap\n  Argo\n    On effectiveness")
        let two = Self.plan("mindmap\n  Argo\n    On effectiveness<br/>and features")

        #expect(two.size.height > one.size.height)
    }

    /// Every branch is drawn back to the node it hangs from, or the map is a scatter of boxes.
    @Test
    func `every node but the root is joined to its parent`() {
        let joins = Self.plan(Self.source).figures.filter {
            if case .path = $0.form {
                true
            } else {
                false
            }
        }

        #expect(joins.count == 9)
        #expect(joins.allSatisfy { $0.role == .edge })
    }
}
