import ArgoEngine
import Foundation

/// How full the Session's context is, and how alarmed to be about it. A surface receives a reading
/// it draws, never a number it judges — the whole colour decision is the tier function below.
extension SessionHeaderProjection {
    package struct Context: Equatable, Sendable {
        /// Which of the two lines the Session is past. **`nil` is the honest gap** — a record that
        /// carried no usage at all — and is never `.okay`: an unread context and an empty one are
        /// opposite claims. `okay` rather than the spec's `ok`: a name here is a word.
        enum Tier: Equatable, Sendable {
            case okay
            case warn
            case crit
        }

        /// The word over the reading. Its capitals are the type's treatment, so they are not
        /// written into the string.
        let label = "Context"
        let tier: Tier?
        /// `217k / 1M`, or `unknown` where the record gave a value Argo cannot put against the
        /// window. A Session that has reported no spend at all gets no `Context` at all, so this
        /// never stands for one Argo has simply not heard from yet.
        let reading: String
        /// How much of the bar is filled, `0...1`. Absent — an EMPTY indicator — for an unreadable
        /// context, and clamped at full so a Session past a window Argo guessed wrong does not draw
        /// outside its own bar.
        let fill: Double?
        /// Where the two policy lines fall on the bar, as fractions of it. Empty alongside an
        /// absent `fill`: a bar with nothing in it has nothing to have crossed.
        let marks: [Double]
        /// The reading said out loud, since a bar is ink and a screen reader hears none of it.
        let detail: String
    }

    /// The window and the two lines drawn across it.
    ///
    /// The two thresholds are **Argo's own policy and DIRECT** — a fixed number of tokens rather
    /// than a share of the window, which sidesteps the model-dependent denominator `CONTEXT.md`
    /// warns about: the ink a Session wears never depends on a window Argo may have read wrong.
    /// Only the count they are compared against is DERIVED.
    ///
    /// `capacity` is the denominator the reading is printed against, ONE number for every Session
    /// — the window of the models this build reads. It moves no threshold and decides no colour.
    enum ContextPolicy {
        static let capacity = 1_000_000
        /// Handing off is worth doing.
        static let warn = 150_000
        /// Handing off is overdue.
        static let crit = 300_000
    }

    /// The instrument for a reading, and **`nil` for a Session that has said nothing about its
    /// window yet** (#1249) — the surface draws no reading, no meter and no fact row for it. An
    /// absent fact is not an unreadable one: `unknown` belongs to a spend Argo DID read and cannot
    /// use, and a new Session wearing it reads as a fault (`CONTEXT.md` Honesty tier).
    static func context(reading: ContextReading) -> Context? {
        switch reading {
        case .unread:
            nil
        case .unreadable:
            Context(
                tier: nil,
                reading: "unknown",
                fill: nil,
                marks: [],
                detail: "Context unknown",
            )
        case let .held(tokens):
            instrument(at: tokens)
        }
    }

    /// The reading, the meter and the two lines drawn across it, for a window Argo can put a
    /// number against.
    private static func instrument(at tokens: Int) -> Context {
        let capacity = Double(ContextPolicy.capacity)
        let held = TokenCount.short(tokens)
        let window = TokenCount.short(ContextPolicy.capacity)
        return Context(
            tier: tier(at: tokens),
            reading: "\(held) / \(window)",
            fill: min(1, Double(tokens) / capacity),
            marks: [Double(ContextPolicy.warn) / capacity, Double(ContextPolicy.crit) / capacity],
            detail: "Context \(held) of \(window)",
        )
    }

    /// The spec's own function, spelled in Swift and nowhere else in the app.
    private static func tier(at tokens: Int) -> Context.Tier {
        if tokens >= ContextPolicy.crit {
            return .crit
        }
        if tokens >= ContextPolicy.warn {
            return .warn
        }
        return .okay
    }
}
