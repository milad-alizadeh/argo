import ArgoEngine
import SwiftUI

/// The composer's own states — typing, a refused send, a kept draft, a queued follow-up — at the
/// width the feed column gives the vessel. The composed state (glass over a real reading, the fade
/// under it) is the deck's case; what these add is what only the vessel itself can show.
struct ComposerSpecimen: View {
    let composer: SessionComposerProjection.Composer

    /// Where the window's opening focus is parked. Left to itself the field is the first key
    /// view, and macOS select-alls a focused field's text — which renders a draft as a selection,
    /// a state this case is not about.
    @FocusState private var parked: Bool
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

    init(
        composer: SessionComposerProjection.Composer = ComposerSpecimen.composer,
        draft: ComposerDraft = ComposerDraft(),
        isDropTargeted: Bool = false,
        commands: CommandCatalog = CommandCatalog.empty,
        files: [String] = [],
    ) {
        self.composer = composer
        _held = State(initialValue: draft)
        self.isDropTargeted = isDropTargeted
        self.commands = commands
        self.files = files
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.clear
                .frame(height: ArgoStroke.border)
                .focusable()
                .focused($parked)
                .focusEffectDisabled()
            SessionComposer(
                composer: composer,
                send: { _, _ in },
                commands: { commands },
                files: { files },
                draft: $held,
                isDropTargeted: isDropTargeted,
            )
            .padding(.horizontal, ArgoSpacing.section)
            .padding(.bottom, ArgoSpacing.loose)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .argoDeckSurface()
        .defaultFocus($parked, true)
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

    /// What an interrupt leaves (#541): an empty vessel back at rest, and one quiet line saying
    /// where the words went. A state of its own because the EMPTINESS is the whole claim — a reader
    /// who typed a follow-up and stopped the Turn has to find out from the seam rather than from
    /// noticing their message is gone, and only a render can settle whether the line is enough.
    static let stopped = ComposerDraft(notice: ComposerDraft.cleared)

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

#Preview("Composer specimen — typing") {
    ComposerSpecimen(draft: ComposerSpecimen.typing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — at the six-line ceiling") {
    ComposerSpecimen(draft: ComposerSpecimen.ceiling)
        .frame(width: 900, height: 420)
        .argoAppearance()
}

#Preview("Composer specimen — a refused send") {
    ComposerSpecimen(draft: ComposerSpecimen.refused)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a draft that was kept") {
    ComposerSpecimen(draft: ComposerSpecimen.kept)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a queued follow-up") {
    ComposerSpecimen(composer: ComposerSpecimen.running, draft: ComposerSpecimen.queued)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — standing allows") {
    ComposerSpecimen(composer: ComposerSpecimen.standing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — three attachments") {
    ComposerSpecimen(draft: ComposerSpecimen.attached)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a pasted image") {
    ComposerSpecimen(draft: ComposerSpecimen.pasted)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a file held over the vessel") {
    ComposerSpecimen(isDropTargeted: true)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — an adapter that takes no attachments") {
    ComposerSpecimen(
        composer: ComposerSpecimen.noAttach,
        draft: ComposerSpecimen.refusedAttachment,
    )
    .frame(width: 900, height: 320)
    .argoAppearance()
}

#Preview("Composer specimen — a stance the ladder has no rung for") {
    ComposerSpecimen(composer: ComposerSpecimen.nearly)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a stance Argo cannot establish") {
    ComposerSpecimen(composer: ComposerSpecimen.unknownMode)
        .frame(width: 900, height: 320)
        .argoAppearance()
}
