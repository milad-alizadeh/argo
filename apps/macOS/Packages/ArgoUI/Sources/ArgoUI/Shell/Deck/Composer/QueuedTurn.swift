import ArgoEngine
import Foundation

/// One follow-up held until the running Turn ends (design decision 4).
///
/// An identified value rather than a bare `String`, because the chip that draws it can be
/// cancelled: two identical follow-ups are two things a user may take back separately, and a list
/// keyed by its own text would take the wrong one back.
struct QueuedTurn: Identifiable, Equatable {
    let id: UUID
    let text: String
    /// What was on the tray when this was queued (#540). It travels WITH the words rather than
    /// staying behind in the tray: a picture attached to a follow-up and delivered with whatever
    /// message happened to go next is the file reaching a different question from the one it was
    /// meant to answer.
    let attachments: [SessionAttachment]

    init(id: UUID = UUID(), text: String, attachments: [SessionAttachment] = []) {
        self.id = id
        self.text = text
        self.attachments = attachments
    }
}
