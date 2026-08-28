import Foundation

/// A quadrant chart as its source wrote it: what the field is called, what each axis measures at
/// both of its ends, what each of the four corners means, and the points plotted on it.
///
/// Everything is optional and nothing is ordered. A quadrant chart states facts ABOUT a field
/// rather than a sequence of anything, so a source is a set of lines and the layout draws the same
/// field whichever order they arrived in.
struct MermaidQuadrant: Equatable, Sendable {
    var title = ""
    var xAxis = Axis()
    var yAxis = Axis()
    /// One per `Corner`, in `Corner.allCases` order — mermaid's numbering, not the order an eye
    /// takes the corners in.
    var corners = ["", "", "", ""]
    var points: [Point] = []

    /// What an axis is called at each end. `x-axis Low --> High` names both; `x-axis Low` names
    /// only where the scale starts, which is a chart mermaid draws.
    struct Axis: Equatable, Sendable {
        var start = ""
        var end = ""
    }

    struct Point: Equatable, Sendable {
        let name: String
        /// Where it plots: 0…1 on both axes, with y running UP. `0.9` is near the TOP, which is
        /// the other way up from the coordinates it is drawn in.
        let at: CGPoint
    }

    /// Mermaid's own numbering of the corners: `quadrant-1` is the TOP RIGHT, and they run
    /// anticlockwise from there. Reading order would put `quadrant-1` top left and mirror every
    /// chart drawn.
    enum Corner: Int, CaseIterable, Equatable, Sendable {
        case one = 1, two, three, four

        var isRight: Bool {
            switch self {
            case .one, .four: true
            case .two, .three: false
            }
        }

        var isTop: Bool {
            switch self {
            case .one, .two: true
            case .three, .four: false
            }
        }
    }
}

extension MermaidQuadrant {
    /// One label per caption the plan places, in that order: the title, both ends of the x axis,
    /// both ends of the y axis, the four corners, then each point's name.
    ///
    /// Every one is listed even where it says nothing. The view builds one `Text` per label and the
    /// plan places one caption per label BY POSITION, so a title dropped for being empty would
    /// slide every later caption one place along.
    var labels: [MermaidLabel] {
        let quiet = MermaidMeasure.edgeFace
        var labels = [MermaidLabel(text: title, face: .header)]
        labels += [xAxis.start, xAxis.end, yAxis.start, yAxis.end]
            .map { MermaidLabel(text: $0, face: quiet, role: .axis) }
        labels += corners.map { MermaidLabel(text: $0, face: quiet, role: .note) }
        labels += points.map { MermaidLabel(text: $0.name, face: quiet) }
        return labels
    }
}
