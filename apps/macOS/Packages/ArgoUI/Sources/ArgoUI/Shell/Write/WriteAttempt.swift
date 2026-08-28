import ArgoEngine

/// Where one provider-port write has got to: nothing in flight, one on the wire, or the last one
/// refused.
///
/// The **whole** of what a write control's owner has to hold, and deliberately not a queue: §4 of
/// `cockpit-failure-states-spec.md` rules out auto-retry, so there is nothing to hold a second
/// attempt in. Re-pressing after a failure starts a new one from `idle`'s own rules.
///
/// `failed` holds the error rather than a sentence: the words are the surface's to choose, and the
/// provider's own have to survive to the control unedited (§5).
enum WriteAttempt: Equatable, Sendable {
    case idle
    case pending
    case failed(WorkItemWriteError)
}
