import ArgoEngine
@testable import ArgoUI
import Testing

/// A follow-up typed while a Turn is running: held rather than sent, cancellable while it waits,
/// and delivered when the Turn ends (design decision 4) — in the order it was typed, one to each
/// boundary, because the one that goes starts the Turn the next waits for (#1337).
@Suite("Composer queue")
@MainActor
struct ComposerQueueTests {
    @Test
    func `a turn submitted while one runs is queued, not sent`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "And then open the PR.")

        draft.submit(whileTurnInFlight: true) { text, _ in try driver.send(text, to: "session-a") }

        #expect(driver.sent(to: "session-a").isEmpty)
        #expect(draft.queued.map(\.text) == ["And then open the PR."])
        // The field clears the way a sent one does: the words are visibly held above it now.
        #expect(draft.text.isEmpty)
    }

    @Test
    func `a turn submitted while nothing runs goes straight through`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "Fix the caption.")

        draft.submit(whileTurnInFlight: false) { text, _ in try driver.send(text, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Fix the caption."])
        #expect(draft.queued.isEmpty)
    }

    /// Oldest first, and ONE to each put: a follow-up that goes starts a Turn, and the one
    /// behind it waits for that Turn's own boundary (#1337). Three boundaries, three follow-ups,
    /// in the order they were typed.
    @Test
    func `queued turns are delivered in the order they were typed, one to each boundary`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["First", "Second", "Third"] {
            draft.text = text
            draft
                .submit(whileTurnInFlight: true) { text, _ in
                    try driver.send(text, to: "session-a")
                }
        }

        for _ in draft.queued.indices {
            draft.putNext { text, _ in try driver.send(text, to: "session-a") }
            // The record catching up with the Turn that put started — what a boundary waits on.
            draft.turnStarted()
        }

        #expect(driver.sent(to: "session-a") == ["First", "Second", "Third"])
        #expect(draft.queued.isEmpty)
    }

    /// Why one put is enough: the put claims the Turn it started, and the claim is what the
    /// release reads to decline until the record has seen that Turn run. Without it the reading
    /// straight after this one still says the Session is at rest, and the rest of the queue goes
    /// to a CLI already busy with what just went (#1337).
    @Test
    func `a put follow-up claims the Turn it started until the record shows it`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "First")
        draft.submit(whileTurnInFlight: true) { text, _ in try driver.send(text, to: "session-a") }

        draft.putNext { text, _ in try driver.send(text, to: "session-a") }
        #expect(draft.isAwaitingPutTurn)
        draft.turnStarted()

        #expect(!draft.isAwaitingPutTurn)
    }

    /// A refused put claims nothing: no Turn started, so nothing is waiting on the record and the
    /// reader's Retry is free to try the same follow-up at the very next reading.
    @Test
    func `a refused put claims no Turn`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "First")
        draft.submit(whileTurnInFlight: true) { text, _ in try driver.send(text, to: "session-a") }
        driver.refusal = .notDrivable

        draft.putNext { text, _ in try driver.send(text, to: "session-a") }

        #expect(!draft.isAwaitingPutTurn)
    }

    /// The chip's `×`: cancelling one must leave the rest of the queue exactly where it was.
    @Test
    func `cancelling one queued turn leaves the others waiting`() {
        var draft = ComposerDraft()
        for text in ["First", "Second", "Third"] {
            draft.text = text
            draft.submit(whileTurnInFlight: true) { _, _ in }
        }

        draft.cancel(draft.queued[1].id)

        #expect(draft.queued.map(\.text) == ["First", "Third"])
    }

    /// A put that hits a refusal stops there; the rest stay queued and the seam carries the
    /// reason.
    @Test
    func `a refused put keeps the turns it never reached`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["First", "Second"] {
            draft.text = text
            draft
                .submit(whileTurnInFlight: true) { text, _ in
                    try driver.send(text, to: "session-a")
                }
        }
        driver.refusal = .notDrivable

        draft.putNext { text, _ in try driver.send(text, to: "session-a") }

        #expect(draft.queued.map(\.text) == ["First", "Second"])
        #expect(draft.refusal == SessionDriveError.notDrivable.detail)
    }

    /// Nothing to put is not an event: a Turn ending on a Session nobody queued anything for
    /// must not clear a refusal the user has not read yet.
    @Test
    func `putting from an empty queue changes nothing`() {
        var draft = ComposerDraft(text: "Carry on.", refusal: "Argo no longer holds this Session")

        draft.putNext { _, _ in }

        #expect(draft.text == "Carry on.")
        #expect(draft.refusal == "Argo no longer holds this Session")
    }

    /// The seam's Retry after a refused put. The words went into the queue before they were ever
    /// put to the Session, so the field is empty and Retry must read the queue.
    @Test
    func `retrying a refused put reads the queue, not the empty field`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft()
        for text in ["First", "Second"] {
            draft.text = text
            draft
                .submit(whileTurnInFlight: true) { text, _ in
                    try driver.send(text, to: "session-a")
                }
        }
        driver.refusal = .notDrivable
        draft.putNext { text, _ in try driver.send(text, to: "session-a") }
        driver.refusal = nil

        draft.retry { text, _ in try driver.send(text, to: "session-a") }

        // The one the refusal reached, and only that one: Retry is the reader asking for the
        // release that was refused, and the rest wait for the boundary as they always did (#1337).
        #expect(driver.sent(to: "session-a") == ["First"])
        #expect(draft.queued.map(\.text) == ["Second"])
        #expect(draft.refusal == nil)
    }

    /// With nothing queued, Retry is the field's own second attempt — design decision 8's remedy
    /// for a send that was refused where it was typed.
    @Test
    func `retrying a refused send puts the field back`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "Carry on with the plan.")
        draft.send { text, _ in try driver.send(text, to: "session-a") }
        driver.refusal = nil

        draft.retry { text, _ in try driver.send(text, to: "session-a") }

        #expect(driver.sent(to: "session-a") == ["Carry on with the plan."])
        #expect(draft.text.isEmpty)
    }

    /// The same guard `send` carries, at the other entry point: a bare Return at a live prompt
    /// must not queue an empty follow-up any more than it may send one.
    @Test
    func `whitespace alone is neither sent nor queued`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "   \n ")

        draft.submit(whileTurnInFlight: true) { text, _ in try driver.send(text, to: "session-a") }
        draft.submit(whileTurnInFlight: false) { text, _ in try driver.send(text, to: "session-a") }

        #expect(draft.queued.isEmpty)
        #expect(driver.sent(to: "session-a").isEmpty)
    }
}
