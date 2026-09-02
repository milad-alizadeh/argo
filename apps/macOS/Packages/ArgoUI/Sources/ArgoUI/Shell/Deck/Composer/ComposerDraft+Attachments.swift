import ArgoEngine

/// What the tray above the field does to a draft (#540).
///
/// Beside `ComposerDraft` rather than inside it because the send rules and the tray rules are two
/// subjects, and the value they act on is one. Every one of them is a claim a test makes without a
/// view: whether a drop lands, whether an `×` takes back the one that was pointed at, and whether a
/// refused drop says so instead of doing nothing.
extension ComposerDraft {
    /// Take what was dropped, pasted, or picked — appended, because the order the chips are in is
    /// the order the Turn will name their paths in.
    ///
    /// Answering the capability here rather than at each gesture is what keeps the three of them
    /// saying the same thing: the `+` is simply absent when `canAttach` is false, and a drop or a
    /// paste that reaches this is refused with the reason rather than landing nowhere.
    mutating func attach(_ incoming: [SessionAttachment], canAttach: Bool) {
        guard !incoming.isEmpty else { return }
        guard canAttach else {
            say(ComposerSeamLine(SessionDriveError.cannotAttach.detail))
            return
        }
        attachments.append(contentsOf: incoming)
        say(nil)
    }

    /// Take one back — the chip's `×`. By id and never by name: a screenshot pasted twice is two
    /// things, and the one the user pointed at is the one that goes.
    mutating func remove(_ attachment: SessionAttachment.ID) {
        attachments.removeAll { $0.id == attachment }
    }
}
