import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The tray's rules, proved against the port's own fake rather than a render: what a drop puts on
/// it, what the `×` takes off, what leaves with a Turn, and what an adapter that takes none says.
@Suite("Composer attachments")
@MainActor
struct ComposerAttachmentTests {
    @Test
    func `a dropped file lands on the tray`() {
        var draft = ComposerDraft()

        draft.attach([Self.dropped], canAttach: true)

        #expect(draft.attachments.map(\.name) == ["notes.md"])
        #expect(draft.notice == nil)
    }

    /// One chip shape for every source, and one rule: a paste is appended exactly as a drop is.
    @Test
    func `a pasted image lands beside a dropped file, in the order they were given`() {
        var draft = ComposerDraft()

        draft.attach([Self.dropped], canAttach: true)
        draft.attach([Self.pasted], canAttach: true)

        #expect(draft.attachments.map(\.name) == ["notes.md", SessionAttachment.pastedImageName])
    }

    /// By id and never by name: a screenshot pasted twice is two things, and the one the user
    /// pointed at is the one that goes.
    @Test
    func `the chip's cross takes back the one it was on`() {
        let first = Self.pasted
        let second = Self.pasted
        var draft = ComposerDraft(attachments: [first, second])

        draft.remove(first.id)

        #expect(draft.attachments.map(\.id) == [second.id])
    }

    /// Handing the agent a file is a complete thing to have said.
    @Test
    func `a tray with something on it is sendable with no words at all`() {
        #expect(ComposerDraft(attachments: [Self.dropped]).isSendable)
        #expect(!ComposerDraft().isSendable)
    }

    @Test
    func `a sent draft empties the tray as well as the field`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "See the gap.", attachments: [Self.dropped])

        draft.send { text, attachments in
            _ = try driver.attach(attachments, to: "session-a")
            try driver.send(text, to: "session-a")
        }

        #expect(driver.attached(to: "session-a").map(\.name) == ["notes.md"])
        #expect(draft.attachments.isEmpty)
        #expect(draft.text.isEmpty)
    }

    /// Design decision 8, extended to the tray: a failed send leaves everything where it was, so
    /// the retry is the same Turn rather than a message that has lost its files.
    @Test
    func `a refused send keeps the chips where they were dropped`() {
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        var draft = ComposerDraft(text: "See the gap.", attachments: [Self.dropped])

        draft.send { text, _ in try driver.send(text, to: "session-a") }

        #expect(draft.attachments.map(\.name) == ["notes.md"])
        #expect(draft.refusal == SessionDriveError.notDrivable.detail)
    }

    /// A picture attached to a follow-up and delivered with whatever message happened to go next
    /// would be the file reaching a different question from the one it was meant to answer.
    @Test
    func `a follow-up queued mid-Turn takes its attachments with it`() {
        let driver = InMemorySessionDriver()
        var draft = ComposerDraft(text: "And this one.", attachments: [Self.dropped])

        draft.submit(whileTurnInFlight: true) { _, _ in }

        #expect(draft.attachments.isEmpty)
        #expect(draft.queued.first?.attachments.map(\.name) == ["notes.md"])

        draft.flush { text, attachments in
            _ = try driver.attach(attachments, to: "session-a")
            try driver.send(text, to: "session-a")
        }

        #expect(driver.attached(to: "session-a").map(\.name) == ["notes.md"])
    }

    /// Capability is declared, not discovered (design decision 9). The `+` is absent, so the only
    /// way to reach this is a gesture the platform allows over any window — and a gesture that
    /// appears to work and does nothing is the one outcome the decision rules out.
    @Test
    func `an adapter that takes no attachments refuses the drop with the reason`() {
        var draft = ComposerDraft()

        draft.attach([Self.dropped], canAttach: false)

        #expect(draft.attachments.isEmpty)
        #expect(draft.notice == SessionDriveError.cannotAttach.detail)
    }

    /// A chip whose size could not be read shows no figure at all — `Zero KB` would report Argo's
    /// own gap as a fact about the file.
    @Test
    func `an unreadable size renders as an absence rather than as zero`() {
        let unsized = SessionAttachment(
            name: "notes.md",
            byteCount: 0,
            isImage: false,
            source: .file(URL(filePath: "/argo/notes.md")),
        )

        #expect(AttachmentProjection.size(unsized) == nil)
        #expect(AttachmentProjection.size(Self.dropped) != nil)
    }

    /// The seam is one line, so the order IS the behaviour: a refused send outranks a refused drop,
    /// and both outrank housekeeping about a draft that was kept.
    @Test
    func `a refusal outranks a capability notice, and both outrank a kept draft`() {
        // All three true at once: the refusal is the one that speaks.
        let allThree = ComposerDraft(
            text: "Carry on.",
            refusal: SessionDriveError.notDrivable.detail,
            editedAtMs: 0,
            notice: SessionDriveError.cannotAttach.detail,
        )
        #expect(ComposerSeamNote.note(for: allThree, enteredAtMs: 60000)
            == .refusal(ComposerSeamLine(SessionDriveError.notDrivable.detail)))

        // The send that failed is answered; the drop that was refused is not.
        let noticeAndKept = ComposerDraft(
            text: "Carry on.",
            editedAtMs: 0,
            notice: SessionDriveError.cannotAttach.detail,
        )
        #expect(ComposerSeamNote.note(for: noticeAndKept, enteredAtMs: 60000)
            == .notice(ComposerSeamLine(SessionDriveError.cannotAttach.detail)))

        // Nothing went wrong at all — only the words that were waiting.
        let keptOnly = ComposerDraft(text: "Carry on.", editedAtMs: 0)
        #expect(ComposerSeamNote.note(for: keptOnly, enteredAtMs: 60000)
            == ComposerSeamNote.kept(sinceMs: 0, nowMs: 60000))
    }

    /// A drop that landed answers the notice the last one raised — the sentence is about the
    /// gesture, and a new gesture is a new answer.
    @Test
    func `an accepted drop takes the refusal notice away`() {
        var draft = ComposerDraft()
        draft.attach([Self.dropped], canAttach: false)

        draft.attach([Self.dropped], canAttach: true)

        #expect(draft.notice == nil)
    }

    private static var dropped: SessionAttachment {
        SessionAttachment(
            name: "notes.md",
            byteCount: 2048,
            isImage: false,
            source: .file(URL(filePath: "/argo/notes.md")),
        )
    }

    private static var pasted: SessionAttachment {
        SessionAttachment.pastedImage(Data([0x01]), fileExtension: "png")
    }
}
