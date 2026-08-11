import ArgoEngine
@testable import ArgoUI
import Testing

/// A follow-up typed while a Turn is running: held rather than sent, cancellable while it waits,
/// and delivered in the order it was typed the moment the Turn ends (design decision 4).
@Suite("Composer queue")
@MainActor
struct ComposerQueueTests {
    @Test
    func `a turn submitted while one runs is queued, not sent`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "And then open the PR.")

        draft.submit(whileRunning: true) { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a").isEmpty)
        #expect(draft.queued.map(\.text) == ["And then open the PR."])
        // The field clears the way a sent one does: the words are visibly held above it now.
        #expect(draft.text.isEmpty)
    }

    @Test
    func `a turn submitted while nothing runs goes straight through`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "Fix the caption.")

        draft.submit(whileRunning: false) { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Fix the caption."])
        #expect(draft.queued.isEmpty)
    }

    @Test
    func `queued turns are delivered in the order they were typed`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["First", "Second", "Third"] {
            draft.text = text
            draft.submit(whileRunning: true) { try driver.send($0, to: "session-a") }
        }

        draft.flush { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["First", "Second", "Third"])
        #expect(draft.queued.isEmpty)
    }

    /// The chip's `×`: cancelling one must leave the rest of the queue exactly where it was.
    @Test
    func `cancelling one queued turn leaves the others waiting`() {
        var draft = ComposerDraft()
        for text in ["First", "Second", "Third"] {
            draft.text = text
            draft.submit(whileRunning: true) { _ in }
        }

        draft.cancel(draft.queued[1].id)

        #expect(draft.queued.map(\.text) == ["First", "Third"])
    }

    /// A flush that hits a refusal stops there; the rest stay queued and the seam carries the
    /// reason.
    @Test
    func `a refused flush keeps the turns it never reached`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["First", "Second"] {
            draft.text = text
            draft.submit(whileRunning: true) { try driver.send($0, to: "session-a") }
        }
        driver.refusal = .notDrivable

        draft.flush { try driver.send($0, to: "session-a") }

        #expect(draft.queued.map(\.text) == ["First", "Second"])
        #expect(draft.refusal == SessionDriveError.notDrivable.detail)
    }

    /// Nothing to flush is not an event: a Turn ending on a Session nobody queued anything for
    /// must not clear a refusal the user has not read yet.
    @Test
    func `flushing an empty queue changes nothing`() {
        var draft = ComposerDraft(text: "Carry on.", refusal: "Argo no longer holds this Session")

        draft.flush { _ in }

        #expect(draft.text == "Carry on.")
        #expect(draft.refusal == "Argo no longer holds this Session")
    }

    /// The seam's Retry after a refused flush. The words went into the queue before they were ever
    /// put to the Session, so the field is empty and Retry must read the queue.
    @Test
    func `retrying a refused flush puts the queue back, not the empty field`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["First", "Second"] {
            draft.text = text
            draft.submit(whileRunning: true) { try driver.send($0, to: "session-a") }
        }
        driver.refusal = .notDrivable
        draft.flush { try driver.send($0, to: "session-a") }
        driver.refusal = nil

        draft.retry { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["First", "Second"])
        #expect(draft.queued.isEmpty)
        #expect(draft.refusal == nil)
    }

    /// With nothing queued, Retry is the field's own second attempt — design decision 8's remedy
    /// for a send that was refused where it was typed.
    @Test
    func `retrying a refused send puts the field back`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "Carry on with the plan.")
        draft.send { try driver.send($0, to: "session-a") }
        driver.refusal = nil

        draft.retry { try driver.send($0, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Carry on with the plan."])
        #expect(draft.text.isEmpty)
    }

    /// The same guard `send` carries, at the other entry point: a bare Return at a live prompt
    /// must not queue an empty follow-up any more than it may send one.
    @Test
    func `whitespace alone is neither sent nor queued`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "   \n ")

        draft.submit(whileRunning: true) { try driver.send($0, to: "session-a") }
        draft.submit(whileRunning: false) { try driver.send($0, to: "session-a") }

        #expect(draft.queued.isEmpty)
        #expect(driver.sent(to: "session-a").isEmpty)
    }
}
