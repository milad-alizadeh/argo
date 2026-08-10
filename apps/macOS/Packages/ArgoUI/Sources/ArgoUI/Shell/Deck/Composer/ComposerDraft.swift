import ArgoEngine

/// What the field holds, and why the last attempt to send it did not go.
///
/// A value beside the view rather than state inside it, so the composer's two rules — a sent
/// draft clears, a refused one stays put with the reason — are claims a test can make against the
/// port's own fake instead of against renders nobody diffs.
struct ComposerDraft: Equatable {
    var text: String
    /// Why the last send was refused, in the seam's words — and `nil` the moment one goes
    /// through, because a reason standing over a message that was delivered is a warning about
    /// nothing.
    private(set) var refusal: String?

    init(text: String = "", refusal: String? = nil) {
        self.text = text
        self.refusal = refusal
    }

    /// Whether there is anything to send — the port's own rule, so the disabled control and the
    /// driver's refusal cannot disagree about what an empty message is.
    var isSendable: Bool {
        SessionTurn.isSendable(text)
    }

    /// Put the draft to the Session through `deliver`. A refusal keeps every character where it
    /// was typed and says why — a failed send must never clear the field.
    mutating func send(via deliver: (String) throws -> Void) {
        do {
            try deliver(text)
            text = ""
            refusal = nil
        } catch let refused as SessionDriveError {
            refusal = refused.detail
        } catch {
            refusal = error.localizedDescription
        }
    }
}
