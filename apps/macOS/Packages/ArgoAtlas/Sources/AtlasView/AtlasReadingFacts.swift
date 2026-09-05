import ArgoDesign
import AtlasLayout
import SwiftUI

/// The four things a reader is told plainly: how many lines, how many authors, how many commits,
/// and how old (#1154, the approved design's `#read .facts`).
///
/// One line rather than four table rows, because these are numbers a reader already understands
/// without being shown a range — the design's own reason for keeping the gauge for the one Measure
/// a number cannot carry alone.
struct AtlasReadingFacts: View {
    @Environment(\.argo) private var argo

    let facts: [AtlasFactReading]

    var body: some View {
        // One line where the rail is wide enough for one, and a pair of lines where it is not.
        // The rail is dragged by the reader and a fact can grow — "commits not measured" is four
        // times the width of "47 commits" — so a single row would run a fact off the edge at the
        // very widths where the panel has the most to say.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ArgoSpacing.comfortable) {
                ForEach(facts, id: \.fact) { said($0) }
            }
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                ForEach(facts, id: \.fact) { said($0) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func said(_ reading: AtlasFactReading) -> some View {
        Text(sentence(of: reading))
            .argoText(ArgoTypography.control)
            .foregroundStyle(argo.color.text.tertiary)
            .lineLimit(1)
            .fixedSize()
    }

    /// One fact, as a sentence: the figure in the machine face and the word for it in the
    /// interface face, which is how the approved render sets them.
    ///
    /// A file the repository measured nothing for SAYS SO, and the saying is the whole of the
    /// ticket's last criterion: "0 commits" and "no commits recorded" are different claims, and
    /// only one of them is true of a file git has no history for.
    private func sentence(of reading: AtlasFactReading) -> AttributedString {
        guard let value = reading.value else {
            return AttributedString("\(word(of: reading.fact)) not measured")
        }
        var figure = AttributedString(figure(of: reading.fact, value: value))
        figure.font = ArgoTypography.machineEmphasis.font
        figure.foregroundColor = argo.color.text.primary.color
        return figure + AttributedString(" " + counted(reading.fact, value: value))
    }

    /// The figure itself. Every fact but the age is a count the generator wrote down; the age is
    /// held in whole weeks and said in whatever unit is legible at that age.
    private func figure(of fact: AtlasFact, value: Double) -> String {
        switch fact {
        case .lines, .authors, .commits: value.formatted(.measured)
        case .age: AtlasAge(weeks: value).said
        }
    }

    /// The word after the figure, singular where the figure is one — "1 authors" is a sentence
    /// nobody writes, and the panel is read as English rather than as a table.
    private func counted(_ fact: AtlasFact, value: Double) -> String {
        switch fact {
        case .lines: value == 1 ? "line" : "lines"
        case .authors: value == 1 ? "author" : "authors"
        case .commits: value == 1 ? "commit" : "commits"
        case .age: "old"
        }
    }

    /// What the fact is called when there is no figure to put in front of it.
    private func word(of fact: AtlasFact) -> String {
        switch fact {
        case .lines: "lines"
        case .authors: "authors"
        case .commits: "commits"
        case .age: "age"
        }
    }
}

/// How old a file is, said short enough to sit inline beside three counts (#1154).
///
/// The generator records whole weeks, and weeks is the wrong unit at both ends: a file committed
/// yesterday reads as 0 weeks, and one untouched for four years reads as 208. So the unit follows
/// the age — the design's own `AGE`.
struct AtlasAge {
    let weeks: Double

    var said: String {
        let days = weeks * 7
        if days < 14 {
            return "\(days.rounded().formatted(.measured))d"
        }
        if days < 60 {
            return "\((days / 7).rounded().formatted(.measured))w"
        }
        if days < 730 {
            return "\((days / 30.4).rounded().formatted(.measured))mo"
        }
        return "\((days / 365).formatted(.measured))y"
    }
}
