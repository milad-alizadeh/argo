import Foundation

/// One follow-up held until the running Turn ends (design decision 4).
///
/// An identified value rather than a bare `String`, because the chip that draws it can be
/// cancelled: two identical follow-ups are two things a user may take back separately, and a list
/// keyed by its own text would take the wrong one back.
struct QueuedTurn: Identifiable, Equatable {
    let id: UUID
    let text: String

    init(id: UUID = UUID(), text: String) {
        self.id = id
        self.text = text
    }
}
