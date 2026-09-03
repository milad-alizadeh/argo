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
/// Read off the main actor since ADR-0030: every store this retires is filled by the
/// whole-document measure pass as well as by the drawing, so the poll is behind a lock like they
/// are (`ProseStore`). `NSFont.preferredFont` is itself `nonisolated`, and the reading was only
/// ever on the main actor because its readers were.
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
        polled.withLock { poll in
            // The last reading before the clock, never after: `poll` initialises itself off the
            // same clock on its first touch, so reading the clock first makes the very first
            // difference negative and overflows the unsigned subtraction.
            let last = poll.at
            let now = clock_gettime_nsec_np(CLOCK_UPTIME_RAW)
            guard now - last >= Self.window else { return poll.turns }
            let size = resolved
            let moved = size != poll.size
            poll.size = size
            poll.at = now
            guard moved else { return poll.turns }
            poll.turns += 1
            return poll.turns
        }
    }

    /// One frame at 60 Hz, in nanoseconds. The longest a measurement taken at the old size can be
    /// answered with, and what divides the platform read down to nothing per ask.
    private static let window: UInt64 = 16_000_000

    /// The size last read, the clock it was read at and how many moves have been seen — ONE value
    /// so they are initialised together and written together. Held apart they initialise
    /// separately, and a size lazily read at the moment it is first compared always equals itself,
    /// which is the reading no move can ever be seen against.
    private static let polled = ProseTally(
        (size: resolved, at: clock_gettime_nsec_np(CLOCK_UPTIME_RAW), turns: 0),
    )

    private static var resolved: CGFloat {
        #if DEBUG
            if let moved = moved.withLock({ $0 }) {
                return moved
            }
        #endif
        return NSFont.preferredFont(forTextStyle: .body).pointSize
    }

    #if DEBUG
        /// The size a test moves, because nothing in process moves the real setting — see
        /// `ProseTextSizeTests`.
        private static let moved = ProseTally<CGFloat?>(nil)

        /// Moved, and the reading aged past the window with it, so the move lands on the next ask
        /// rather than a frame later.
        public static func move(to size: CGFloat?) {
            moved.withLock { $0 = size }
            polled.withLock { $0.at = 0 }
        }
    #endif
}
