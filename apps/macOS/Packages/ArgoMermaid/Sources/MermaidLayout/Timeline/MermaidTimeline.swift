import Foundation

/// A timeline as its source wrote it: what it is called, and the periods under each band in the
/// order they were written, each carrying whatever happened in it.
struct MermaidTimeline: Equatable, Sendable {
    /// Empty where the source named it nothing, so an absent title is a caption that is not
    /// placed rather than an optional threaded through the layout.
    var title = ""
    var sections: [Section] = []

    struct Section: Equatable, Sendable {
        /// Empty for the band a timeline that never says `section` keeps all its periods in.
        var name = ""
        var periods: [Period] = []
    }

    struct Period: Equatable, Sendable {
        let name: String
        /// Mermaid draws a period nothing happened in, so this is a list and not a requirement.
        var events: [String] = []
    }
}

extension MermaidTimeline {
    /// The timeline as the banded layout reads it: a period is a column and each of its events is
    /// a row stacked beneath, on the heights every column reserves.
    ///
    /// The bands take the series palette here, because what a reader tells apart across a timeline
    /// is which era they are looking at.
    var bands: MermaidBands {
        MermaidBands(title: title, sections: sections.enumerated().map { at, section in
            MermaidBands.Section(
                name: section.name,
                role: .series(at),
                columns: section.periods.map { period in
                    MermaidBands.Column(
                        heading: period.name,
                        score: nil,
                        notes: period.events.map { MermaidBands.Note(text: $0, role: .node) },
                    )
                },
            )
        })
    }

    var labels: [MermaidLabel] {
        bands.labels
    }

    var laid: MermaidPlan {
        bands.laid
    }
}
