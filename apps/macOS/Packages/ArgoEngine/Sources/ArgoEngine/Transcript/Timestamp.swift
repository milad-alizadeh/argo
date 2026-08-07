import Foundation

// A record's `timestamp` is an ISO-8601 string the host wrote. Milliseconds since the epoch is what
// the engine carries: an integer compares and subtracts without a calendar, and every consumer of a
// span wants a duration rather than a date.

private let withFraction = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
private let withoutFraction = Date.ISO8601FormatStyle(includingFractionalSeconds: false)

/// A record's timestamp in milliseconds, or `nil` where it carried none it could read.
///
/// Both precisions are tried because both are written: Claude Code stamps fractional seconds, and
/// a host that does not is not thereby unreadable. An unparseable stamp reads as absent, never as
/// zero — a fabricated 1970 sorts a live record to the top of the feed.
func timestampMs(_ record: JSONValue) -> Int? {
    guard let raw = record.stringField("timestamp") else { return nil }
    guard let date = (try? withFraction.parse(raw)) ?? (try? withoutFraction.parse(raw)) else {
        return nil
    }
    return Int(date.timeIntervalSince1970 * 1000)
}
