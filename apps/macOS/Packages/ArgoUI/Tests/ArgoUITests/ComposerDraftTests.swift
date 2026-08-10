import ArgoEngine
@testable import ArgoUI
import Testing

/// The composer's two send rules, proved against the port's own fake rather than a render: a
/// sent draft clears, a refused one stays put with the reason.
@Suite("Composer draft")
@MainActor
struct ComposerDraftTests {
    @Test
    func `a sent draft clears the field and reaches the Session`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "Fix the caption, not the sort.")

        draft.send { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Fix the caption, not the sort."])
        #expect(draft.text.isEmpty)
        #expect(draft.refusal == nil)
    }

    @Test
    func `a multi-line draft arrives as the one message it was`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "Fix the caption.\nThe sort is right.")

        draft.send { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Fix the caption.\nThe sort is right."])
    }

    /// Design decision 8: a failed send does not clear the field. The message stays where it was
    /// typed, with the reason beside it.
    @Test
    func `a refused draft keeps every character and says why`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "Carry on with the plan.")

        draft.send { try driver.send($0, to: "session-a") }

        #expect(draft.text == "Carry on with the plan.")
        #expect(draft.refusal == SessionDriveError.notDrivable.detail)
        #expect(driver.sent(to: "session-a").isEmpty)
    }

    /// The seam is about the LAST attempt: a reason left standing over a message that went
    /// through afterwards would be a warning about nothing.
    @Test
    func `a send that goes through takes the standing refusal with it`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "Are you there")
        draft.send { try driver.send($0, to: "session-a") }
        driver.refusal = nil

        draft.send { try driver.send($0, to: "session-a") }

        #expect(draft.refusal == nil)
        #expect(draft.text.isEmpty)
        #expect(driver.sent(to: "session-a") == ["Are you there"])
    }

    /// The port's own rule, read through the draft so the disabled send control and the driver's
    /// refusal cannot disagree.
    @Test
    func `whitespace alone is not sendable`() {
        #expect(!ComposerDraft(text: "  \n\t ").isSendable)
        #expect(!ComposerDraft().isSendable)
        #expect(ComposerDraft(text: "a").isSendable)
    }
}
