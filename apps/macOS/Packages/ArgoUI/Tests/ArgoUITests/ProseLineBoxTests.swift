@testable import ArgoUI
import SwiftUI
import Testing

/// How tall one line of a face stands, against what SwiftUI draws that face at.
///
/// This is the whole of `ProseLineBox`, and the claim it exists to make: the box is READ off the
/// ruler rather than worked out from the font. Every height in the feed and in the overview lane is
/// one box plus its advances, so a face measured a point out puts a gap under a message, an overlap
/// under the row below it, or — a Turn at a time, down a long reading — a click on the lane 22
/// points from what was clicked.
@MainActor
@Suite("Prose line box")
struct ProseLineBoxTests {
    /// Every face the feed sets prose in, including the two that only markup reaches.
    private static let faces: [ProseFace] = [
        .body,
        .machine,
        .header,
        .heading(level: 1),
        .heading(level: 2),
        .heading(level: 3),
        ProseFace(rung: ArgoTypography.sectionLabel.rung),
    ]

    private static func drawn(_ face: ProseFace, lines: Int) -> CGFloat {
        let ruler = NSHostingController(rootView: AnyView(
            Text(Array(repeating: "A", count: lines).joined(separator: "\n"))
                .argoText(face.rung, face.isBold ? .semibold : nil)
                .lineSpacing(face.leading),
        ))
        ruler.sizingOptions = []
        defer { ruler.rootView = AnyView(EmptyView()) }
        return ruler.sizeThatFits(
            in: NSSize(width: 400, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }

    /// The claim itself, at line counts the reading actually holds — and at 40, which no probe
    /// looks at, so a box that merely fits the three it was chosen on fails here.
    @Test(arguments: [1, 2, 3, 5, 8, 40])
    func `a run of a face stands where SwiftUI draws it`(lines: Int) {
        for face in Self.faces {
            #expect(
                ceil(face.height(ofLines: lines)) == Self.drawn(face, lines: lines),
                "\(face.key) at \(lines) lines",
            )
        }
    }

    /// The box is one of the two candidates, never something in between: a measured box that
    /// matched nothing would mean the rule is neither, and a height read off a single drawing is a
    /// height nothing holds at another line count.
    @Test
    func `a measured box is one of the two the font offers`() {
        for face in Self.faces {
            let box = face.lineBox
            let candidates = ProseEngine.allCases.map { face.lineBox(under: $0) }
            #expect(candidates.contains(box), "\(face.key) measured \(box), offered \(candidates)")
        }
    }

    /// Neither candidate is the same for every face — which is why the choice cannot be made once
    /// for the process, as the first fix for this tried to. On the machine this runs on, at least
    /// one face takes each.
    @Test
    func `the two candidates really do differ`() {
        let apart = Self.faces.filter {
            $0.lineBox(under: .fractional) != $0.lineBox(under: .wholePoint)
        }
        #expect(!apart.isEmpty)
        for face in apart {
            #expect(face.lineBox(under: .wholePoint) > face.lineBox(under: .fractional))
            #expect(face.lineBox(under: .wholePoint) - face.lineBox(under: .fractional) < 2)
        }
    }

    /// A run is one box and `n − 1` advances. SwiftUI's `lineSpacing` is the leading BETWEEN lines,
    /// so a run's last line adds no trailing gap, and the advance is off the FRACTIONAL box however
    /// the box itself was read.
    @Test
    func `a run is one box and the advances under it`() {
        for face in Self.faces {
            #expect(face.height(ofLines: 0) == 0)
            #expect(face.height(ofLines: 1) == face.lineBox)
            let advance = face.height(ofLines: 5) - face.height(ofLines: 4)
            #expect(abs(advance - face.step) < 0.0001, "\(face.key)")
            let leading = face.step - face.lineBox(under: .fractional)
            #expect(abs(leading - face.leading) < 0.0001, "\(face.key)")
        }
    }
}
