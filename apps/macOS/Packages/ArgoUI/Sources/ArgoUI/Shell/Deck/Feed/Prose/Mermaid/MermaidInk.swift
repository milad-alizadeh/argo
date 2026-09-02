import ArgoDesign
import SwiftUI

/// What a diagram's roles are drawn in: the one place a `MermaidRole` becomes a colour.
///
/// A value resolved at the call site rather than an environment read mid-draw — `MermaidView` reads
/// the palette in its body and hands the colours to the canvas, exactly as the prose renderer is
/// handed a marked span's ground.
struct MermaidInk: Sendable {
    let palette: ArgoPalette

    /// The line a figure of this role is stroked in, and the words a caption of it is set in.
    func line(of role: MermaidRole) -> ArgoColor {
        switch role {
        case .node: palette.edge.subtle
        case .edge: palette.text.tertiary
        case .emphasis: palette.interaction.accent
        case .note: palette.text.tertiary
        // A boundary and not a hue of its own: what separates one slice from the slice beside it
        // is the same lit edge every other figure is bounded by.
        case .series: palette.edge.subtle
        case .axis: palette.edge.hairline
        }
    }

    /// The ground under it, or `nil` for a role that is a line rather than a container.
    ///
    /// The weight reaches the SERIES ramp and nothing else: "the same thing, spent" is a question
    /// only a categorical mark has an answer to, and a half-laid node ground would just read as a
    /// hole in the surface.
    func ground(of role: MermaidRole, at weight: MermaidFigure.Weight) -> ArgoColor? {
        switch role {
        case .node: palette.surface.raised
        case .edge, .emphasis, .note, .axis: nil
        case let .series(index): palette.series.hue(index, at: weight.hue)
        }
    }

    /// The ink a caption of this role is set in. A node's words are the message's own rung, so a
    /// diagram reads at the loudness of the prose it sits in.
    func words(of role: MermaidRole) -> ArgoColor {
        switch role {
        case .node: palette.text.primary
        case .edge, .note: palette.text.secondary
        case .axis: palette.text.tertiary
        case .emphasis: palette.interaction.accent
        // A word in a series role is written ON that series' fill, which is the one ink the ramp
        // holds for words on a colour rather than on a surface.
        case .series: palette.text.onAccent
        }
    }
}

private extension MermaidFigure.Weight {
    /// The same three rungs the contract spells, which is where the values live. Two enums for one
    /// idea on purpose: a plan states a weight without importing the palette's vocabulary, exactly
    /// as it states a role without naming a colour.
    var hue: ArgoPalette.SeriesRoles.Weight {
        switch self {
        case .spent: .spent
        case .ordinary: .ordinary
        case .full: .full
        }
    }
}
