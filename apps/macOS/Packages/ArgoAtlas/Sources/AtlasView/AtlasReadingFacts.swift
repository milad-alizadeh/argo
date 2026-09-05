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
                ForEach(facts, id: \.fact) { line($0) }
            }
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                ForEach(facts, id: \.fact) { line($0) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func line(_ reading: AtlasFactReading) -> some View {
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
            return AttributedString(AtlasUnmeasured.beside(reading.fact.noun))
        }
        var figure = AttributedString(figure(of: reading.fact, value: value))
        figure.font = ArgoTypography.machineEmphasis.font
        figure.foregroundColor = argo.color.text.primary.color
        return figure + AttributedString(" " + reading.fact.counted(value))
    }

    /// The figure itself. Every fact but the age is a count the generator wrote down; the age is
    /// held in whole weeks and said in whatever unit is legible at that age.
    private func figure(of fact: AtlasFact, value: Double) -> String {
        switch fact {
        case .lines, .authors, .commits: value.formatted(.measured)
        case .age: AtlasAge(weeks: value).short
        }
    }
}

/// How old a file is, short enough to sit inline beside three counts (#1154).
///
/// The generator records whole weeks, and weeks is the wrong unit at both ends: a file committed
/// yesterday reads as 0 weeks, and one untouched for four years reads as 208. So the unit follows
/// the age — the design's own `AGE`.
struct AtlasAge {
    let weeks: Double

    /// Where each unit gives way to the next, in DAYS. Editorial cut-offs rather than conversions,
    /// which is why they are named: a fortnight is where a count of days stops being legible, two
    /// months is where a count of weeks does, and two years is where a count of months does.
    private static let weeksFrom: Double = 14
    private static let monthsFrom: Double = 60
    private static let yearsFrom: Double = 730

    /// The lengths themselves. `daysPerMonth` is the mean Gregorian month rather than 30, so a
    /// file two years old does not read as 24 months and 8 days' worth of drift.
    private static let daysPerWeek: Double = 7
    private static let daysPerMonth = 30.4
    private static let daysPerYear: Double = 365

    var short: String {
        let days = weeks * Self.daysPerWeek
        if days < Self.weeksFrom {
            return "\(days.rounded().formatted(.measured))d"
        }
        if days < Self.monthsFrom {
            return "\((days / Self.daysPerWeek).rounded().formatted(.measured))w"
        }
        if days < Self.yearsFrom {
            return "\((days / Self.daysPerMonth).rounded().formatted(.measured))mo"
        }
        return "\((days / Self.daysPerYear).formatted(.measured))y"
    }
}

/// How the panel says a number nobody measured — once, so the three places that have to say it
/// cannot say it three ways (#1154's "a file with a missing measure says so rather than showing
/// zero").
///
/// It is the panel's own words rather than the Map's, because absence is a fact about the
/// measurement and the Map has no way to spell it: JSON carries a missing key, not a sentence.
enum AtlasUnmeasured {
    /// A row or a cell whose figure is missing, where the name of the thing is already beside it.
    static let alone = "not measured"

    /// The same absence where the reader needs telling WHAT was not measured, because there is no
    /// figure for the name to sit in front of.
    static func beside(_ noun: String) -> String {
        "\(noun) \(alone)"
    }

    /// The absence of the banded Measure, which is a whole sentence: the gauge is a block with a
    /// heading, and a two-word fragment under one reads as a broken control.
    static let onTheGauge = "Not measured for this file."
}
