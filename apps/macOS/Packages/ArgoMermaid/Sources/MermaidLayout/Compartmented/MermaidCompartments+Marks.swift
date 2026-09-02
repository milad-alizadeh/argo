import Foundation
import ProseText

// How much room a compartmented box needs, what it draws in the room it was given, and where each
// of its words goes in there.
//
// The captions come back in the very order `lines` lists them, because `MermaidLayout` pairs one
// `Text` to one caption by position alone — a line that kept no place would move every label after
// it onto the wrong box.

@MainActor
extension MermaidCompartments {
    /// The room the whole box needs: its widest line, and every band's own words stacked with the
    /// breathing room each band keeps around them.
    var size: CGSize {
        // The words of every band at once, so the box is as wide as its widest LINE — and then as
        // deep as its bands really stack, which is one inset per band rather than one per box.
        CGSize(
            width: MermaidWords.box(of: lines.joined(separator: "\n")).width,
            height: runs.reduce(0) { $0 + Self.depth(ofLines: $1.count) },
        )
    }

    /// The box itself, and a rule under every band but the last.
    func marks(in box: CGRect) -> [MermaidFigure] {
        var figures = [MermaidFigure(form: .shape(.rect, box))]
        var y = box.minY
        for run in runs.dropLast() {
            y += Self.depth(ofLines: run.count)
            figures.append(MermaidFigure(form: .path([
                CGPoint(x: box.minX, y: y), CGPoint(x: box.maxX, y: y),
            ])))
        }
        return figures
    }

    /// Every line, placed: the head centred under its own name, the members flush left down the
    /// band they were written in.
    func captions(in box: CGRect) -> [MermaidCaption] {
        var placed: [MermaidCaption] = []
        var y = box.minY
        for (at, run) in runs.enumerated() {
            placed += Self.rows(run, in: CGRect(
                x: box.minX + MermaidMeasure.nodeInsetX,
                y: y + MermaidMeasure.nodeInsetY,
                width: max(0, box.width - MermaidMeasure.nodeInsetX * 2),
                height: ProseFace.body.height(ofLines: run.count),
            ), head: at == 0)
            y += Self.depth(ofLines: run.count)
        }
        return placed
    }

    /// One band's lines, each on its own line box inside the room the box's inset left it.
    private static func rows(_ run: [String], in band: CGRect, head: Bool) -> [MermaidCaption] {
        run.enumerated().map { at, text in
            MermaidCaption(
                label: MermaidLabel(text: text),
                rect: CGRect(
                    x: band.minX,
                    y: band.minY + ProseFace.body.y(ofLine: at),
                    width: band.width,
                    height: ceil(ProseFace.body.lineBox),
                ),
                alignment: head ? .middle : .leading,
            )
        }
    }

    /// How deep one band stands: its own lines, and the inset above and below them.
    private static func depth(ofLines lines: Int) -> CGFloat {
        ceil(ProseFace.body.height(ofLines: lines)) + MermaidMeasure.nodeInsetY * 2
    }
}
