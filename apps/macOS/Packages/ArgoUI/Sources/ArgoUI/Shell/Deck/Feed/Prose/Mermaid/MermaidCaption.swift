import Foundation

/// A string a diagram sets, and the face it is set in.
///
/// Held on the MODEL and not only on the placed caption, because the view builds one `Text` per
/// label before SwiftUI has told it a measure — and a plan cannot be laid out without one.
struct MermaidLabel: Equatable, Sendable {
    let text: String
    /// The feed's own prose face by default, so a diagram sets at the rhythm of the paragraphs
    /// around it rather than at a scale of its own.
    var face: ProseFace = .body
    var role: MermaidRole = .node
}

/// One label, placed: the rect it was measured into, and how it sits in it.
struct MermaidCaption: Equatable, Sendable {
    let label: MermaidLabel
    let rect: CGRect
    var alignment: Alignment = .middle

    /// How a caption sits in its rect. The plan's own word rather than SwiftUI's: a plan is drawn
    /// by a view and mapped by the lane, and only one of those two has an `Alignment`.
    enum Alignment: Equatable, Sendable {
        case leading, middle, trailing
    }
}
