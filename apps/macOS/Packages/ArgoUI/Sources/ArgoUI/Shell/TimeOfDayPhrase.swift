import ArgoEngine
import Foundation

/// A moment as a wall clock, `14:32:07` — the fact that tells two Sessions apart when everything
/// else about them is one prompt template (#1567).
///
/// Beside `AgePhrase` and shared for the same reason: one spelling of a moment, so one app does
/// not read as two. Fixed 24-hour and to the SECOND, because the runs of a `-p` loop can open
/// inside the same minute and a disambiguator that repeats disambiguates nothing.
enum TimeOfDayPhrase {
    /// `nil` for a moment nothing recorded: an absent stamp is a gap, and a clock standing in for
    /// one would be exactly the invented DIRECT fact `degrade-down` exists to refuse.
    static func phrase(atMs: Int?, calendar: Calendar = .current) -> String? {
        guard let atMs else { return nil }
        let parts = calendar.dateComponents(
            [.hour, .minute, .second], from: Date(epochMs: atMs),
        )
        guard let hour = parts.hour, let minute = parts.minute, let second = parts.second
        else { return nil }
        return String(format: "%02d:%02d:%02d", hour, minute, second)
    }
}
