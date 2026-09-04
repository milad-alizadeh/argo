import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The composer's own states — typing, a refused send, a kept draft, a queued follow-up — at the
/// width the feed column gives the vessel. The composed state (glass over a real reading, the fade
/// under it) is the deck's case; what these add is what only the vessel itself can show.
struct ComposerSpecimen: View {
    let composer: SessionComposerProjection.Composer

    /// The vessel writes through a binding now, so a case that renders one has to hold the value.
    @State private var held: ComposerDraft

    /// Holds the drag-over state open, which no render can reach otherwise (#540).
    let isDropTargeted: Bool
    /// The catalog the `/` menu draws (#685). Empty by default, so a case that is not about the
    /// menu cannot accidentally open one.
    let commands: CommandCatalog
    /// The Workspace tree the `@` menu draws (#687). Empty by default, for the reason `commands`
    /// is: a case that is not about the menu cannot accidentally list a file.
    let files: [String]
    /// What `AddMenu`, or the listing behind one of its rows, should already show — `.closed` by
    /// default, so a case that is not about `+` cannot accidentally open it (#689).
    let opening: ComposerMenusOpening

    init(
        composer: SessionComposerProjection.Composer = ComposerSpecimen.composer,
        draft: ComposerDraft = ComposerDraft(),
        isDropTargeted: Bool = false,
        commands: CommandCatalog = CommandCatalog.empty,
        files: [String] = [],
        opening: ComposerMenusOpening = .closed,
    ) {
        self.composer = composer
        _held = State(initialValue: draft)
        self.isDropTargeted = isDropTargeted
        self.commands = commands
        self.files = files
        self.opening = opening
    }

    /// A send that goes nowhere, and the two menus reading the fixtures this case was built with.
    private var intents: DeckIntents {
        DeckIntents(send: { _, _ in }, commands: { commands }, files: { files }, draft: $held)
    }

    var body: some View {
        ComposerStage {
            SessionComposer(
                composer: composer,
                intents: intents,
                isDropTargeted: isDropTargeted,
                opening: opening,
            )
        }
    }

    /// The typing state's draft: multi-line, because the growth past one line IS the state.
    static let typing = ComposerDraft(
        text: """
        The roster sorts on last activity, but the caption still says "by name".
        Fix the caption, not the sort: the sort is right.

        While you are in there, check whether SessionRow reads the same field twice.
        """,
    )

    /// Past the six-line ceiling, where the field stops growing and scrolls inside itself. The
    /// state exists to prove the feed above is never squeezed out by a long message.
    static let ceiling = ComposerDraft(
        text: typing.text + """


        And if it does, pull it up into the projection rather than into a computed property on \
        the row — the row should be handed a value, never derive one.

        Then run the contract suite and tell me what moved.
        """,
    )

    /// Three chips over a message that refers to them — the state a drop and a paste both end in,
    /// and the one that shows a picture, a source file and a log wearing one chip shape (#540).
    static var attached: ComposerDraft {
        ComposerDraft(
            text: "This is what the roster does after a compaction — see the gap at the top.",
            attachments: AttachmentFixture.mixed,
        )
    }

    /// What ⌘V leaves: one chip, named for the gesture rather than for a file, beside a message
    /// short enough that the tray is what the render is about.
    static var pasted: ComposerDraft {
        ComposerDraft(
            text: "Same bug, from the other machine.",
            attachments: [AttachmentFixture.pasted],
        )
    }

    /// A drop an adapter would not take, refused on the seam with the reason (design decision 9).
    static let refusedAttachment = ComposerDraft(notice: SessionDriveError.cannotAttach.detail)

    /// What an interrupt leaves (#541): the words still in the field, no chips above it, and one
    /// quiet line saying which of the two went. A state of its own because the PAIRING is the whole
    /// claim — the reader has to read the line as being about the follow-ups they can no longer see
    /// rather than about the message they can, and only a render settles that.
    static let stopped = ComposerDraft(
        text: "No, not that file — the one under Sources.",
        notice: ComposerDraft.droppedQueue,
    )

    /// A rung picked while the Turn was running (#940). The picker draws it under `≈` and ticks
    /// nothing; the seam carries the port's refusal beside what Argo did with the intent. What the
    /// render has to settle is that the pair reads as ONE held intent rather than as a control that
    /// took a click and moved somewhere nobody asked for.
    static let modeHeld = ComposerDraft(notice: ComposerDraft.held(.auto), heldMode: .auto)

    /// The refused state's draft: the message still where it was typed, the reason above it —
    /// in the port's own words, so the render and the seam cannot drift apart.
    static let refused = ComposerDraft(
        text: "Carry on with the plan.",
        refusal: SessionDriveError.notDrivable.detail,
    )

    /// A Turn the CLI never heard, come back to the field it was typed in (#682). The words are
    /// the state: the reader watched the composer clear, so only a render settles whether finding
    /// their message BACK reads as a recovery rather than as something they failed to send.
    static let lost = ComposerDraft(
        text: "what is @README.md about?",
        notice: ComposerDraft.lost,
    )

    /// The bare `/`: the whole catalogue, sectioned by origin (#685).
    static let commanding = ComposerDraft(text: "/")

    /// Typed far enough to narrow it: the sections stop being origins and become prefix matches
    /// then the ones that merely contain the characters, with origin moved onto the rows.
    static let commandFiltered = ComposerDraft(text: "/impl")

    /// The two edges in one line — the collision and the skill that states no description are both
    /// under `writ`, which is what the study found and not what a fixture would have invented.
    static let commandEdge = ComposerDraft(text: "/writ")

    /// A perfectly good thing to say to an agent that matches no command. The surface stays and the
    /// line stays sendable (decision 8).
    static let commandZero = ComposerDraft(text: "/graphify")

    /// After a pick: the command in the field with the caret behind it, arguments typed as ordinary
    /// text, and no menu — the space is what closed it (decision 1).
    static let commandArgs = ComposerDraft(text: "/code-review since main")

    /// The menu open over a Turn in flight with a follow-up already waiting (decision 17). The two
    /// surfaces stack above the field, which is the whole of what this state settles.
    static let commandQueued = ComposerDraft(
        text: "/",
        queued: [QueuedTurn(text: "And when that is green, open the PR against main.")],
    )

    /// The bare `@` mid-sentence: the whole tree, the files this Session has been in first
    /// (`at.png`). The `@` is the last thing typed, which is what holds the menu open.
    static let mentioning = ComposerDraft(text: "Have a look at @")

    /// Six keystrokes into a nine-segment path (`at-filter.png`, decision 13). `sesdri` is a
    /// SUBSEQUENCE over the whole path, so it reaches `…/Session/SessionDriver.swift` — and no
    /// substring search would find it.
    static let mentionFiltered = ComposerDraft(text: "Have a look at @sesdri")

    /// After a pick (`at-inserted.png`): the whole path in the line as TEXT and not a chip, the
    /// sentence carried on after it, and NO menu — the space the insertion left is what closed it.
    static let mentionInserted = ComposerDraft(
        text: "Have a look at @apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/"
            + "SessionDriver.swift — the send path swallows a CR.",
    )

    /// A path this Workspace does not hold. The surface stays and the line stays sendable, exactly
    /// as the `/` menu's zero state does — the agent may know where the file went.
    static let mentionZero = ComposerDraft(text: "Have a look at @qqqqzz")

    /// A follow-up waiting on the Turn in flight, drawn above an empty field.
    static let queued = ComposerDraft(
        queued: [QueuedTurn(text: "And when that is green, open the PR against main.")],
    )

    /// A release the port would not take (#1238): two follow-ups still above the field, the seam
    /// carrying the reason with the Retry that answers it, and the ONE the release reached wearing
    /// a different word.
    ///
    /// Its own state because the pairing is the whole claim — a chip that says only `QUEUED` after
    /// a refused release is indistinguishable from one nothing ever tried, which is the picture
    /// the defect was reported from.
    /// Reached by RUNNING a release the port refuses, rather than by setting the fields behind
    /// one: which follow-up wears the word is the draft's own answer, and a fixture that stated it
    /// could draw a pairing the app never produces.
    static var queueRefused: ComposerDraft {
        var draft = ComposerDraft(queued: [
            QueuedTurn(text: "And when that is green, open the PR against main."),
            QueuedTurn(text: "Then put the ticket number in the title."),
        ])
        draft.flush { _, _ in throw SessionDriveError.notDrivable }
        return draft
    }

    /// A follow-up being steered into the running Turn (#1238): the interrupt has gone and the
    /// words have not, so this one says `SENDING` and offers no controls while the one behind it
    /// still says `QUEUED` and offers both.
    ///
    /// Reached by RUNNING the act, for the reason `queueRefused` above is.
    static var queueSteering: ComposerDraft {
        var draft = ComposerDraft(queued: [
            QueuedTurn(text: "And when that is green, open the PR against main."),
            QueuedTurn(text: "Then put the ticket number in the title."),
        ])
        _ = draft.beginSteer(draft.queued[1].id, via: {})
        return draft
    }

    /// A draft that survived leaving the Session and coming back. Measured back from whenever the
    /// case is rendered rather than stamped once, for the reason the roster's ages are: a fixed
    /// millisecond would age into `3y ago` in the render it is meant to prove.
    static var kept: ComposerDraft {
        let anHourAgo = WallClock.nowMs() - 51 * 60 * 1000
        return ComposerDraft(
            text: "Before the PR: check that the scroll anchor survives a compaction. I think it",
            editedAtMs: anHourAgo,
        )
    }
}
