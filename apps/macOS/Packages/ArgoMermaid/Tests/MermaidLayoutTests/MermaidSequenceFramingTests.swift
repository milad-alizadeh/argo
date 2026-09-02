import Foundation
@testable import MermaidLayout
import Testing

/// The three things drawn ON a sequence diagram rather than between two of its lifelines: the bars
/// that say a participant is busy, the notes set beside them, and the frames drawn around a block.
@MainActor
@Suite("Mermaid sequence framing")
struct MermaidSequenceFramingTests {
    private typealias Layout = MermaidSequenceLayoutTests

    private static func plan(_ body: String) -> MermaidPlan {
        Layout.plan(body)
    }

    /// The bars: filled rects standing ON a lifeline, which is what tells them from the boxes at
    /// the head of one.
    private static func bars(of plan: MermaidPlan) -> [CGRect] {
        Layout.shapes(of: plan, .rect).filter { $0.minY > 0 }
    }

    @Test(arguments: [
        "A->>B: call\nactivate B\nB-->>A: reply\ndeactivate B",
        "A->>+B: call\nB-->>-A: reply",
    ])
    func `an activation draws a bar on the lifeline it names`(body: String) {
        let plan = Self.plan(body)
        let lines = Layout.lifelines(of: plan)
        let bars = Self.bars(of: plan)

        #expect(bars.count == 1)
        #expect(bars.first.map { abs($0.midX - lines[1][0].x) < $0.width } == true)
        #expect(bars.first?.height ?? 0 > 0)
    }

    /// A run inside a run is drawn beside its own caller rather than hidden under it.
    @Test
    func `a nested activation stands clear of the one that opened it`() {
        let bars = Self.bars(of: Self.plan("""
        A->>+B: call
        A->>+B: again
        B-->>-A: inner
        B-->>-A: outer
        """))

        #expect(bars.count == 2)
        #expect(Set(bars.map(\.minX)).count == 2)
    }

    /// An arrow lands on the bar of the run it belongs to, not on the line behind it.
    @Test
    func `an arrow stops at the bar it lands on`() {
        let plain = Self.plan("A->>B: call")
        let active = Self.plan("A->>+B: call")
        let tip = { (plan: MermaidPlan) in
            Layout.paths(of: plan).first { $0.count == 2 && $0[0].y == $0[1].y }?[1].x
        }

        #expect((tip(active) ?? 0) < (tip(plain) ?? 0))
    }

    /// A run nobody closed runs to the foot of the diagram, which is what a half-written source
    /// most often means.
    @Test
    func `an activation nobody closed runs to the foot`() {
        let plan = Self.plan("A->>+B: call\nA->>B: again")

        #expect(Self.bars(of: plan).first?.maxY ?? 0 >= plan.size.height - 1)
    }

    @Test(arguments: ["left of", "right of", "over"])
    func `a note stands where it says it does`(placement: String) {
        let plan = Self.plan("A->>B: go\nNote \(placement) B: waiting")
        let lines = Layout.lifelines(of: plan)
        let note = Self.bars(of: plan).last

        #expect(note != nil)
        switch placement {
        case "left of": #expect(note?.maxX ?? 0 < lines[1][0].x)
        case "right of": #expect(note?.minX ?? 0 > lines[1][0].x)
        default: #expect(note.map { $0.contains(CGPoint(x: lines[1][0].x, y: $0.midY)) } == true)
        }
    }

    @Test
    func `a note is as wide as the words in it`() {
        let short = Self.bars(of: Self.plan("A->>B: go\nNote over A: hi"))
        let long = Self.bars(of: Self.plan("A->>B: go\nNote over A: a much longer aside"))

        #expect(short.last?.width ?? 0 < long.last?.width ?? 0)
    }

    /// A note over two lifelines reaches from one to the other.
    @Test
    func `a note over two participants spans both`() {
        let plan = Self.plan("A->>B: go\nNote over A,B: together")
        let lines = Layout.lifelines(of: plan)
        let note = Self.bars(of: plan).last

        #expect(note?.minX ?? 0 <= lines[0][0].x)
        #expect(note?.maxX ?? 0 >= lines[1][0].x)
    }

    private static func frames(of plan: MermaidPlan) -> [CGRect] {
        Layout.shapes(of: plan, .enclosure)
    }

    @Test(arguments: ["loop", "opt", "par", "critical", "alt"])
    func `each block draws one labelled frame`(keyword: String) {
        let plan = Self.plan("\(keyword) when it fails\nA->>B: retry\nend")

        #expect(Self.frames(of: plan).count == 1)
        #expect(plan.captions.map(\.label.text).contains("\(keyword) [when it fails]"))
    }

    /// A frame spans exactly the lifelines its block touches — never one it does not own.
    @Test
    func `a frame spans the participants inside it and no others`() {
        let plan = Self.plan("""
        A->>B: one
        loop twice
        B->>C: two
        end
        """)
        let lines = Layout.lifelines(of: plan)
        let frame = Self.frames(of: plan).first

        #expect(frame?.minX ?? 0 > lines[0][0].x)
        #expect(frame?.maxX ?? 0 > lines[2][0].x)
    }

    @Test
    func `a nested frame is drawn inside the one that contains it`() {
        let frames = Self.frames(of: Self.plan("""
        alt found
        A->>B: one
        loop twice
        A->>B: two
        end
        end
        """))

        #expect(frames.count == 2)
        #expect(frames.first.map { outer in frames.dropFirst().allSatisfy(outer.contains) } == true)
    }

    /// A frame's inset is measured against the deepest the WHOLE diagram nests, so two blocks at
    /// the same depth are drawn the same width — reordering them in the source cannot change one.
    @Test
    func `two blocks at the same depth are inset the same, whatever order they were written in`() {
        let shallowFirst = Self.frames(of: Self.plan("""
        loop once
        A->>B: one
        end
        alt found
        loop twice
        A->>B: two
        end
        end
        """))
        let outers = shallowFirst.filter { frame in
            !shallowFirst.contains { $0 != frame && $0.contains(frame) }
        }

        #expect(outers.count == 2)
        #expect(Set(outers.map(\.minX)).count == 1)
    }

    /// An `else` divides its frame with a rule, and writes its own word under it.
    @Test
    func `a divider rules across the frame it divides`() {
        let plan = Self.plan("""
        alt found
        A->>B: one
        else missing
        A->>B: two
        end
        """)
        let frame = Self.frames(of: plan).first
        let rules = Layout.paths(of: plan).filter { $0.count == 2 && $0[0].y == $0[1].y }

        #expect(plan.captions.map(\.label.text).contains("[missing]"))
        #expect(rules.contains { $0[0].x == frame?.minX && $0[1].x == frame?.maxX })
    }
}
