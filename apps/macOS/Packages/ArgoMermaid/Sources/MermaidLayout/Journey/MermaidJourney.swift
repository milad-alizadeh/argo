import Foundation

/// A user journey as its source wrote it: what it is called, and the tasks under each band in the
/// order they were written.
///
/// The score is held as the INTEGER the source wrote rather than as a fraction of the scale,
/// because mermaid's scale is fixed and a journey that stated `3` did not state `0.6`.
struct MermaidJourney: Equatable, Sendable {
    /// What the journey is called. Empty where the source named it nothing, so an absent title is
    /// a caption that is not placed rather than an optional threaded through the layout.
    var title = ""
    var sections: [Section] = []

    /// The rating every task is written on. Mermaid's own, and fixed: a score off it is a row this
    /// reader has no rule for.
    static let scale = 5

    struct Section: Equatable, Sendable {
        /// Empty for the band a journey opens with before it names one.
        var name = ""
        var tasks: [Task] = []
    }

    struct Task: Equatable, Sendable {
        let name: String
        /// Always within `1 ... scale` — the reader refuses a row it cannot rate.
        let score: Int
        var actors: [String] = []
    }

    /// Every actor the journey names, once each and in the order it first named them. The run the
    /// chips take their hue from, so one name is one colour wherever it appears.
    var actors: [String] {
        var seen: Set<String> = []
        return sections.flatMap(\.tasks).flatMap(\.actors).filter { seen.insert($0).inserted }
    }
}

extension MermaidJourney {
    /// The journey as the banded layout reads it: a task is a column, its score is the rating the
    /// column shows, and each actor is a chip beneath it in that actor's own hue.
    ///
    /// The band is called OUT rather than filled, because the series palette is spent on the
    /// actors here and a second run of hues in one figure would compete with them.
    var bands: MermaidBands {
        let hues = hues
        return MermaidBands(title: title, sections: sections.map { section in
            MermaidBands.Section(name: section.name, role: .emphasis, columns: section.tasks.map {
                MermaidBands.Column(heading: $0.name, score: $0.score, notes: $0.actors.map {
                    MermaidBands.Note(text: $0, role: hues[$0] ?? .node)
                })
            })
        })
    }

    /// Which hue each actor's chips take. Read off `actors`, so one name is one hue wherever the
    /// journey mentions them.
    private var hues: [String: MermaidRole] {
        Dictionary(uniqueKeysWithValues: actors.enumerated().map { ($1, MermaidRole.series($0)) })
    }

    var labels: [MermaidLabel] {
        bands.labels
    }

    @MainActor var laid: MermaidPlan {
        bands.laid
    }
}
