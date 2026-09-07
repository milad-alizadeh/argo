import Foundation

/// What one read through a port established — the third outcome, beside answered and refused.
///
/// A refusal is `ProviderFetchError` and travels as a throw. `unchanged` is neither: the host
/// answered, and answered that what the reader already holds is still current (#1620). It has to
/// be its own case rather than an empty answer, because for every read in the two polls an empty
/// answer MEANS something — "no pull request on this branch", "nothing open in this repository" —
/// and a tick that saved a request would otherwise erase the mark it was saving it on.
///
/// Generic over what was read so one word covers both port methods and both providers: health is
/// keyed on the Binding rather than on what was being read, and the same is true of freshness.
public enum PortReading<Value> {
    case answered(Value)
    case unchanged

    /// What was read, and `nil` where the host only validated what the caller holds. For a caller
    /// whose two branches are "take this" and "keep what I have".
    public var answer: Value? {
        switch self {
        case let .answered(value): value
        case .unchanged: nil
        }
    }

    /// The same reading with its value mapped, so an adapter can shape an answer without spelling
    /// the `unchanged` case again at every layer it passes through.
    public func map<Mapped>(
        _ transform: (Value) throws -> Mapped,
    ) rethrows
        -> PortReading<Mapped> {
        switch self {
        case let .answered(value): try .answered(transform(value))
        case .unchanged: .unchanged
        }
    }
}

extension PortReading: Equatable where Value: Equatable {}

/// Crossing an actor boundary exactly when what it carries can. `[Page.Item]` is `Sendable` at
/// every real call site, but only conditionally so at the generic one that walks a listing.
extension PortReading: Sendable where Value: Sendable {}
