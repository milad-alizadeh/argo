import Foundation

/// Now, as milliseconds since the epoch — the unit every age in this app is measured in
/// (`SessionAge`, the roster's rows, the composer's seam).
///
/// One function rather than the expression written wherever a stamp is taken: three copies of
/// `Int(Date().timeIntervalSince1970 * 1000)` are three chances for one of them to be seconds.
package enum WallClock {
    package static func nowMs() -> Int {
        Int(Date().timeIntervalSince1970 * 1000)
    }
}
