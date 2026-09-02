import AppKit

/// The Accessibility text setting, as the one number every prose measurement was taken at.
///
/// One rung answers for the whole ladder. The setting scales every style together, so the body's
/// resolved point size moves exactly when a heading's does, and asking once says what the stores
/// were filled at.
///
/// POLLED rather than observed, because there is nothing to observe: AppKit has no
/// `didChangeScreenParametersNotification` sibling for type, and nothing in its headers names one.
/// So the stores ask on the way in, and the ask has to be affordable — asking the platform every
/// time costs a MULTIPLE of the warm measurement it would be part of, which is the whole reason
/// #1027 was not fixed alongside #766.
///
/// Hence the frame. The platform is read at most once a frame and every ask in between reads a
/// clock instead, which is a FRACTION of the same ask. Both figures are recorded once, in
/// `PerfBudgets` — `keyedTextSizeFold` and `textSizeCheckShare`, gating
/// `ProseTextSizeCostTests` (ADR-0028 Rule 7).
@MainActor
public enum ProseTextSize {
    /// How many times the setting has moved in this process.
    ///
    /// A generation and not a `moved` flag: two stores consult this, and a flag the first cleared
    /// would leave the second answering at the old size forever.
    ///
    /// Re-reads the setting when the last reading is more than a frame old, so a reader who moves
    /// their text size is answered at the new one within 16 ms — never a frame the eye can find,
    /// and never the per-ask cost of asking the platform every time.
    public static func epoch() -> Int {
        // The last reading before the clock, never after: `seen` initialises itself off the same
        // clock on its first touch, so reading the clock first makes the very first difference
        // negative and overflows the unsigned subtraction.
        let last = seen.at
        let now = clock_gettime_nsec_np(CLOCK_UPTIME_RAW)
        guard now - last >= Self.window else { return turns }
        let size = resolved
        let moved = size != seen.size
        seen = (size: size, at: now)
        guard moved else { return turns }
        turns += 1
        return turns
    }

    /// One frame at 60 Hz, in nanoseconds. The longest a measurement taken at the old size can be
    /// answered with, and what divides the platform read down to nothing per ask.
    private static let window: UInt64 = 16_000_000

    /// The size last read and the clock it was read at, as ONE static so they are initialised
    /// together. Held apart they initialise separately, and a size lazily read at the moment it is
    /// first compared always equals itself — which is the reading no move can ever be seen against.
    private static var seen = (size: resolved, at: clock_gettime_nsec_np(CLOCK_UPTIME_RAW))
    private static var turns = 0

    private static var resolved: CGFloat {
        #if DEBUG
            if let moved {
                return moved
            }
        #endif
        return NSFont.preferredFont(forTextStyle: .body).pointSize
    }

    #if DEBUG
        /// The size a test moves, because nothing in process moves the real setting — see
        /// `ProseTextSizeTests`. Setting it ages the reading past the window, so the move lands on
        /// the next ask rather than a frame later.
        public static var moved: CGFloat? {
            didSet { seen.at = 0 }
        }
    #endif
}
