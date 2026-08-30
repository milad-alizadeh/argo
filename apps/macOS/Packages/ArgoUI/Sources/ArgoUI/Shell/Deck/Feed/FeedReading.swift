import Foundation

/// WHICH reading the feed's zones are showing, as an identity rather than as rows.
///
/// `FeedRow.ID` is a dense POSITION, so nothing keyed on the rows can tell one reading from
/// another: row 12 of a Session is row 12 of the next one. Every piece of per-reading state below
/// the deck — the folds, the wash, the wait's clock, the measured heights — is keyed on this
/// instead, which is what replaced `.id(session)` on the deck (ADR-0028 Rule 5). Destroying the
/// view identity reset all of it for free and destroyed the table, the rulers and the minimap with
/// it; naming the reading resets the same facts and keeps the geometry.
///
/// Both halves are here because both re-key the rows: a Session switch replaces the reading, and so
/// does scoping the rail onto one Subagent.
struct FeedReading: Hashable {
    /// `CockpitPresentation.Session.ID`, spelled as its underlying type: the feed draws no Session
    /// and must not have to know one. `nil` in a preview, a specimen and a suite, where nothing
    /// switches — which is what keeps those on the plain mount path.
    var session: String?
    var scope: FeedScope = .session

    /// What a reading with no shell above it is: a preview, a specimen, a `#Preview`.
    static let unattached = FeedReading(session: nil)
}

/// One fact about the reading, paired with the reading it is a fact ABOUT.
///
/// A SwiftUI `onChange` key, and the only honest one for a fact whose meaning depends on which
/// reading it was taken from. `rows.count` going 40 → 300 is an arrival worth a wash inside one
/// reading and is nothing at all across a switch, and `FeedWait.showing(in:)` answering the same
/// case for two Sessions in a row is two waits, not one that never stopped.
struct FeedFact<Value: Equatable>: Equatable {
    let reading: FeedReading
    let value: Value
}
