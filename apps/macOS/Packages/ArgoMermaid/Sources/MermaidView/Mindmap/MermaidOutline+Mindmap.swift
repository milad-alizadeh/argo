import MermaidLayout
import SwiftUI

// The two outlines only a mindmap spells. Their own file because `MermaidOutline+Path` draws the
// shapes every diagram type shares, and neither of these is one of them.
//
// Both are built on the box's own ellipse rather than on its corners: a bang and a cloud are round
// things with an edge that leaves the round, and a label sits centred in either.

extension MermaidOutline {
    /// A starburst — mermaid's `))bang((`. Spikes and not bumps, because a bang and a cloud stand
    /// in boxes of the same size and the silhouette is the only thing telling them apart.
    static func bang(in rect: CGRect) -> Path {
        MermaidPath.through((0 ..< MermaidMeasure.bangSpikes * 2).map { at in
            point(
                in: rect,
                atAngle: .pi * CGFloat(at) / CGFloat(MermaidMeasure.bangSpikes),
                reach: at.isMultiple(of: 2) ? 1 : MermaidMeasure.bangNotch,
            )
        }, closed: true)
    }

    /// A run of bumps around a soft body — mermaid's `)cloud(`. Each bump is one quad curve out to
    /// the box's own edge, so the cloud fills the room the label was measured into.
    static func cloud(in rect: CGRect) -> Path {
        let step = CGFloat.pi * 2 / CGFloat(MermaidMeasure.cloudBumps)
        let body = MermaidMeasure.cloudBody
        var path = Path()
        path.move(to: point(in: rect, atAngle: 0, reach: body))
        for bump in 1 ... MermaidMeasure.cloudBumps {
            let angle = step * CGFloat(bump)
            path.addQuadCurve(
                to: point(in: rect, atAngle: angle, reach: body),
                control: point(in: rect, atAngle: angle - step / 2, reach: 1),
            )
        }
        path.closeSubpath()
        return path
    }

    /// A point on the box's ellipse, `reach` of the way out to it.
    private static func point(in rect: CGRect, atAngle angle: CGFloat, reach: CGFloat) -> CGPoint {
        CGPoint(
            x: rect.midX + cos(angle) * rect.width / 2 * reach,
            y: rect.midY + sin(angle) * rect.height / 2 * reach,
        )
    }
}
