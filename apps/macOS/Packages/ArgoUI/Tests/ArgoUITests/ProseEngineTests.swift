import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// The two rounding rules a text engine can hold a run of lines to, and the reading of which one is
/// in force.
///
/// The engine this suite RUNS on is only ever one of them, so the other is held by arithmetic
/// against the same font — which is the whole point: the rule that broke
/// `FeedTypesetHeightTests` on CI was the rule no machine here runs, and it went unwritten
/// because nothing could exercise it.
@MainActor
@Suite("Prose engine")
struct ProseEngineTests {
    private static let faces = [ProseFace.body, .machine, .header, .heading(level: 1)]

    /// A snapping engine rounds the BOX out at both ends and nothing else — so it stands over the
    /// fractional answer by what those two roundings come to, however many lines are in the run.
    /// Never by more, which is what says the advances were left alone.
    @Test(arguments: [1, 2, 3, 12])
    func `a snapped run stands over the fractional one by its box alone`(lines: Int) {
        for face in Self.faces {
            let snapped = face.height(ofLines: lines, under: .wholePoint)
            let fractional = face.height(ofLines: lines, under: .fractional)
            let told = "\(face.key) at \(lines) lines"
            #expect(snapped >= fractional, "\(told)")
            #expect(snapped - fractional < 2, "\(told)")
            let rounded = face.lineBox(under: .wholePoint) - face.lineBox(under: .fractional)
            #expect(abs(snapped - fractional - rounded) < 0.0001, "\(told)")
        }
    }

    /// One line is the whole difference between the engines, and it is a whole point under the
    /// snapping one.
    @Test
    func `a snapped box is whole and holds the fractional one`() {
        for face in Self.faces {
            let snapped = face.lineBox(under: .wholePoint)
            #expect(snapped == snapped.rounded(.down), "\(face.key)")
            #expect(snapped >= face.lineBox(under: .fractional), "\(face.key)")
        }
    }

    /// Both rules are one box and `n − 1` advances. Nothing else may creep in, because the lane
    /// places a line at `y(ofLine:)` inside a block it sized with this.
    @Test(arguments: [ProseEngine.fractional, .wholePoint])
    func `a run is one box and the advances under it`(engine: ProseEngine) {
        for face in Self.faces {
            #expect(face.height(ofLines: 0, under: engine) == 0)
            #expect(face.height(ofLines: 1, under: engine) == face.lineBox(under: engine))
            // Within a float's own noise: the two sides reach the same number by different
            // additions, and a claim about the RULE cannot be a claim about the last bit of it.
            let advance = face.height(ofLines: 5, under: engine)
                - face.height(ofLines: 4, under: engine)
            #expect(abs(advance - face.step) < 0.0001, "\(face.key)")
        }
    }

    /// The advance is the FRACTIONAL box plus the leading, under both engines. Adding the leading
    /// to the SNAPPED box instead would put a point a line into every wrapped paragraph — eight
    /// lines of body prose draw at 154 on the snapping engine, and that rule says 156.
    @Test
    func `an advance is the fractional box and the leading, whatever the engine`() {
        for (face, leading) in [
            (ProseFace.body, ArgoFeedRow.proseLineSpacing),
            (.machine, ArgoFeedRow.machineLineSpacing),
        ] {
            let fromFractional = face.step - face.lineBox(under: .fractional)
            #expect(abs(fromFractional - leading) < 0.0001, "\(face.key)")
        }
    }

    /// The reading itself: whatever engine this machine holds, the answer under it is the one the
    /// ruler gives — which is the claim `FeedTypesetHeightTests` makes a row at a time.
    @Test
    func `the engine in force is the one the ruler draws through`() {
        let face = ProseFace.body
        let ruler = NSHostingController(rootView: AnyView(
            Text("A\nA\nA")
                .argoText(face.rung)
                .lineSpacing(ArgoFeedRow.proseLineSpacing),
        ))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        let drawn = ruler.sizeThatFits(
            in: NSSize(width: 400, height: CGFloat.greatestFiniteMagnitude),
        ).height

        let told = "drawn \(drawn), engine \(ProseEngine.inForce)"
        switch ProseEngine.inForce {
        case .wholePoint:
            #expect(drawn == face.height(ofLines: 3, under: .wholePoint), "\(told)")
        case .fractional:
            #expect(drawn == ceil(face.height(ofLines: 3, under: .fractional)), "\(told)")
        }
    }
}
