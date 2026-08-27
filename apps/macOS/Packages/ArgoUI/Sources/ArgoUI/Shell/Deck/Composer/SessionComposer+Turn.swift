import ArgoEngine

/// What the composer asks of the Session, and what the seam says when the port refuses (#541,
/// #545, #687, ADR-0024).
///
/// Every act here ends in the draft, because the draft owns what a refusal leaves behind — which
/// is why none of them reports a result of its own.
extension SessionComposer {
    /// `send`, with the mentioned files NAMED where the CLI will not resolve an `@path` itself
    /// (#687). Wrapped once rather than at the three call sites, so a queued Turn and a retried one
    /// carry their files exactly as a straight send does.
    ///
    /// They ride the attachment path and never `draft.attachments`, which is what keeps a mention
    /// out of the tray: it stays a word in the line, and only the Turn that goes names the file.
    var sending: ComposerSend {
        guard !composer.resolvesMentions else { return send }
        return { [composer, send] text, attachments in
            try send(text, ComposerMentions.attaching(
                attachments,
                for: text,
                within: composer.workspaceRoot,
            ))
        }
    }

    /// Stop the Turn, and empty the composer behind it (#541, ADR-0024).
    ///
    /// The clearing happens HERE rather than off the Session going idle, and the order is what
    /// makes it work: the queue is emptied at the click, before the record catches up and the
    /// flush the body watches for fires. Waiting for the status to turn would be waiting for the
    /// exact moment the queued follow-ups are released.
    func interrupt() {
        draft.stopped(via: stop)
    }

    /// Ask the Session for a rung. The control shows nothing of its own, so a refusal needs no
    /// undoing here.
    ///
    /// In a `Task` because the picker's setter cannot wait: the walk takes a keystroke per rung
    /// with a gap behind each (#653), and the note lands when it resolves.
    func ask(for mode: SessionMode) {
        Task {
            do {
                try await setMode(mode)
                draft.modeAsked(refusedWith: nil)
            } catch {
                draft.modeAsked(refusedWith: error)
            }
        }
    }

    /// The seam's remedy, which is not the same act as pressing send: what it puts back is
    /// whatever the refusal stopped, and after a refused flush that is the queue, not the field.
    func retry() {
        draft.retry(via: sending)
    }
}
