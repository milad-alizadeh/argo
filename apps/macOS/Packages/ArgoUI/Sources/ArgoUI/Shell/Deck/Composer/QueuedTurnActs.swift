import Foundation

/// What a reader can do to a follow-up that has not gone yet: send it NOW, or take it back.
///
/// One value rather than three parameters on both the stack and the chip, which is what
/// `swift-boundaries` edge 6 asks for — and they ARE one reading: whether steering is possible at
/// all is a fact about the Session, and it decides whether one of the two acts is drawn.
///
/// Both are keyed by id even on the chip, which draws exactly one: the chip would otherwise take
/// two closures already bound to its own turn, and the two spellings could drift into acting on
/// different follow-ups — which for a cancel is words the reader never meant to lose.
struct QueuedTurnActs {
    /// Whether the steer control is offered at all — `SessionComposer.canSteer` is the answer.
    /// There is nothing to overtake on a Session at rest, and only one steer runs at a time.
    var canSteer = false
    /// Put one into the running Turn now, ahead of the boundary it is waiting for (#1238).
    var steer: (UUID) -> Void = { _ in }
    /// Take one back — the whole point of drawing a queued turn is that it is still recallable.
    var cancel: (UUID) -> Void = { _ in }
}
