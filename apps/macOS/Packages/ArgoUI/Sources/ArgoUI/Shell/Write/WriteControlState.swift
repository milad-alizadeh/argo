import ArgoEngine

/// The whole of what one provider-port write control renders, folded from the two things that
/// decide it: what the port ADMITS (§7) and where the last ATTEMPT got to (§4).
///
/// One value rather than two the view reads in sequence, because the interesting part is the
/// precedence between them — and a precedence spread across a `body`'s `if`s is one no test can
/// reach.
enum WriteControlState: Equatable, Sendable {
    /// Pressable, with nothing to say. Reached from `stale` as well as from healthy: §7 refuses to
    /// disable a control on the guess that a failing read predicts a failing write.
    case live
    /// Disabled in place while a write is on the wire — no spinner, no toast, no layout shift.
    case pending
    /// Pressable again, carrying the refusal's own reason. Pressing IS the retry; nothing retries
    /// on its own.
    case refused(WorkItemWriteError)
    /// Disabled, because there is no usable token for this Account. The one place §7 lets Argo
    /// disable a control, because it is the one place Argo knows rather than guesses.
    case blocked(AccountRecord)
    /// Not a control at all: no Binding to write through. The Connect panel's row is where that is
    /// repaired, so there is nothing here to grey out.
    case absent

    /// The fold. The order of the branches IS the policy, so each is worth its line:
    ///
    /// `noBinding` first — nothing recorded against a port that cannot be written through says
    /// anything about a control that is not drawn. `pending` next: a grant that died mid-flight
    /// does not un-press the button, and both readings disable it anyway. Then the refused grant,
    /// which outranks the last failure's words because it is the one of the two with an action
    /// behind it.
    static func over(
        _ admission: WriteAdmission, _ attempt: WriteAttempt,
    )
        -> WriteControlState {
        switch (admission, attempt) {
        case (.noBinding, _): .absent
        case (_, .pending): .pending
        case let (.refused(account), _): .blocked(account)
        case let (.admitted, .failed(refusal)): .refused(refusal)
        case (.admitted, .idle): .live
        }
    }

    /// Whether there is a control here at all.
    var isDrawn: Bool {
        self != .absent
    }

    /// Whether it may be pressed. A refusal is pressable: §4 returns the control to its prior
    /// state and puts the reason beside it, rather than spending the failure on a dead button.
    var isEnabled: Bool {
        switch self {
        case .live, .refused: true
        case .pending, .blocked, .absent: false
        }
    }
}
