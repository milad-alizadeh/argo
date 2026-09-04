import Foundation

/// Declared on `FormatStyle` rather than on `IntegerFormatStyle` itself, which is how Foundation
/// spells `.number`: an interpolation's style is a generic the compiler infers from this position,
/// and a static on the concrete type is not reachable from it.
public extension FormatStyle where Self == IntegerFormatStyle<Int> {
    /// How Argo writes a figure it has counted: the digits, and never a group separator between
    /// them (#1263).
    ///
    /// SwiftUI formats an `Int` interpolated into a `Text` as a QUANTITY for the reader's locale,
    /// so `Text("×\(repeats)")` writes `×1,234` — and every figure this app draws is a machine
    /// fact rather than a sum anybody adds up: a churn count is what `git` said, a repeat count is
    /// how many calls one line stands for. A separator in one of those is noise the reader has to
    /// read past.
    ///
    /// STILL LOCALIZED, which is the reason this is a format style rather than `Text(verbatim:)`:
    /// the sentences these figures sit inside are English and stay translatable, and a locale with
    /// its own numerals keeps them. Only the grouping goes.
    ///
    /// A Ticket's NUMBER is not one of these — it is an identifier the provider owns, not a
    /// quantity, so it is spelled once as a `String` (`IssueReading.mark`) and never formatted.
    static var machine: Self {
        .number.grouping(.never)
    }
}

/// The same rule for a figure that was MEASURED rather than counted (#1147).
public extension FormatStyle where Self == FloatingPointFormatStyle<Double> {
    /// How Argo writes a figure it measured: the digits, no group separator, and at most one place
    /// after the point.
    ///
    /// A separate style from `machine` because the question it answers is a different one. A count
    /// is a whole number and the only decision is the separator; a measure is whatever the
    /// generator wrote — the Atlas reads five and only one of them is fractional — and the decision
    /// is how much of it to show. One place, because the legend is read at a glance and a file
    /// whose age is 3.4 weeks and one whose age is 3.41 are the same file to the reader.
    static var measured: Self {
        .number.grouping(.never).precision(.fractionLength(0 ... 1))
    }
}

/// A share of a whole, which is neither a count nor a measurement (#1147).
public extension FormatStyle where Self == FloatingPointFormatStyle<Double>.Percent {
    /// How Argo writes a fraction as a share: whole percent, no group separator.
    ///
    /// Whole percent because a share is read at a glance and against a round number — a legend
    /// saying "top 15%" is a claim about the shape of a repository, and a tenth of a percent on
    /// it is precision nobody asked for and floating-point noise nobody wants to see.
    static var share: Self {
        .percent.grouping(.never).precision(.fractionLength(0))
    }
}
