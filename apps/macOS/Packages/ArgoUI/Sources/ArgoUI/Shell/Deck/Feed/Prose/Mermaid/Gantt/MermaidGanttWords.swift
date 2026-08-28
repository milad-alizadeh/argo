import Foundation

/// How wide one of a Gantt chart's words runs.
///
/// Bare metrics and not `MermaidWords`, which measures a label IN A BOX: a tick's date, a section's
/// heading and a task's name each stand free on the surface, so the node inset and the 44pt floor
/// under a one-letter node would both widen them past what they are.
@MainActor
enum MermaidGanttWords {
    /// A tick's own date, at the quiet face every word on the axis is set in.
    static func width(of text: String) -> CGFloat {
        width(of: text, in: MermaidMeasure.edgeFace)
    }

    static func width(of text: String, in face: ProseFace) -> CGFloat {
        ceil(ProseMetrics.width(of: text, in: face))
    }

    /// How tall one line of the quiet face stands, which is the height of every row in the gutter.
    static var line: CGFloat {
        ceil(MermaidMeasure.edgeFace.lineBox)
    }
}
