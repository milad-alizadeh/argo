import Foundation

/// How full the Session's context is, and how alarmed to be about it.
///
/// The whole colour decision is the tier function below, and it lives here rather than in the view
/// for the reason every other header rule does: a threshold crossed in a `body` is a threshold
/// nothing can assert. What a surface receives is a reading it draws, never a number it judges.
extension SessionHeaderProjection {
    struct Context: Equatable, Sendable {
        /// Which of the two lines the Session is past. **`nil` is the honest gap** — a record that
        /// carried no usage at all — and is never `.ok`: an unread context and an empty one are
        /// opposite claims, and the quieter of the two is the one that is not a claim.
        /// `okay` rather than the spec's `ok`: the house rule is that a name is a word, and a
        /// two-letter one is the only thing here that could not be spelled.
        enum Tier: Equatable, Sendable {
            case okay
            case warn
            case crit
        }

        /// The word over the reading. Its capitals are the type's treatment, not the vocabulary's,
        /// which is why they are not written into the string.
        let label = "Context"
        let tier: Tier?
        /// `217k / 1M`, or `unknown` where there is nothing to put against the window.
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
    /// `capacity` is the model's; the two thresholds are **Argo's own policy and DIRECT** — a fixed
    /// number of tokens rather than a share of the window, which is what sidesteps the
    /// model-dependent denominator `CONTEXT.md` warns about. Only the count they are compared
    /// against is DERIVED. They are not user-configurable: this app has no Preferences surface by
    /// design, and a threshold somebody can move is a threshold the ⓘ panel cannot explain.
    enum ContextPolicy {
        static let capacity = 1_000_000
        /// Handing off is worth doing.
        static let warn = 150_000
        /// Handing off is overdue.
        static let crit = 300_000
    }

    static func context(tokens: Int?) -> Context {
        guard let tokens else {
            return Context(
                tier: nil,
                reading: "unknown",
                fill: nil,
                marks: [],
                detail: "Context unknown",
            )
        }
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
