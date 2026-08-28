import ArgoEngine

/// What one provider-port write control renders, folded from what the port admits (§7 of
/// `cockpit-failure-states-spec.md`) and where the last attempt got to (§4).
enum WriteControlState: Equatable, Sendable {
    case live
    /// Disabled in place: no spinner, no toast, no layout shift.
    case pending
    /// Pressable again, carrying the refusal's reason. Pressing is the retry; nothing auto-retries.
    case refused(WorkItemWriteError)
    /// Disabled, because there is no usable token for this Account.
    case blocked(AccountRecord)

    /// A write on the wire outranks a grant that has since been refused: it is already sent, and
    /// both readings disable the control anyway. `noBinding` never disables — the port having no
    /// Binding is not a fact about a write, and whether a control is drawn at all is the room's
    /// vacancy to decide (`WorkChromeProjection.reading`).
    static func over(
        _ admission: WriteAdmission, attempt: WriteAttempt,
    )
        -> WriteControlState {
        switch (admission, attempt) {
        case (_, .pending): .pending
        case let (.refused(account), _): .blocked(account)
        case let (_, .failed(refusal)): .refused(refusal)
        case (.admitted, .idle), (.noBinding, .idle): .live
        }
    }

    /// A refusal stays pressable: §4 returns the control to its prior state and puts the reason
    /// beside it.
    var isEnabled: Bool {
        switch self {
        case .live, .refused: true
        case .pending, .blocked: false
        }
    }
}
