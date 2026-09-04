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
