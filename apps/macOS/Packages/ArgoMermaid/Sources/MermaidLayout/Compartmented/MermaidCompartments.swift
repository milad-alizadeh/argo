import Foundation

/// A box divided into stacked bands of words, each band ruled off from the one above it: the head
/// that names the box, and the members under it.
///
/// The one compartment renderer. A class and an entity are one piece of work precisely because a
/// compartmented box is measured, drawn and captioned the same way for both — the two differ in
/// what they PUT in the bands and in what stands at the ends of the lines between them (#865).
struct MermaidCompartments: Equatable, Sendable {
    /// The words naming the box, set centred — an annotation standing above the name where the
    /// source gave one.
    let head: [String]
    /// The bands under it, each set flush left. A band with nothing in it is not drawn, so an
    /// entity with no attributes is a box with a name rather than a box with an empty room in it.
    var bands: [[String]] = []

    /// Every band that is really drawn, head first. THE order everything else here counts in.
    var runs: [[String]] {
        [head] + bands.filter { !$0.isEmpty }
    }

    /// Every line the box sets, in the order its captions are placed in.
    var lines: [String] {
        runs.flatMap(\.self)
    }

    var labels: [MermaidLabel] {
        lines.map { MermaidLabel(text: $0) }
    }
}
