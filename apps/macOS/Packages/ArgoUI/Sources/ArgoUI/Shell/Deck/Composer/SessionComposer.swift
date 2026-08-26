import ArgoEngine
import SwiftUI

/// The glass vessel the user speaks to a Session through — the field, what is waiting above it,
/// the footer, and the seam that carries a refusal or says the draft was kept.
///
/// Acceptance is the echo, not a toast: the field clears and the words come back as the user's own
/// row in the feed, so success draws nothing here at all.
///
/// The draft is a BINDING and not state of its own: what the user typed lives in `ComposerDrafts`,
/// keyed by Session, so leaving and coming back finds it where it was.
struct SessionComposer: View {
    let composer: SessionComposerProjection.Composer
    /// One Turn to the Session, or a thrown `SessionDriveError` the seam repeats. A closure and
    /// not a driver, so the vessel renders from a preview or a specimen with nothing behind it.
    let send: ComposerSend
    /// Take back a standing allow, by tool (#572). A closure for the reason `send` is.
    let revoke: (String) -> Void
    /// Say the Turn reported lost has been put back, so the news is not delivered twice (#682).
    var lostTurnSeen: () -> Void = {}
    /// Stop the Turn in flight (#541). A closure for the reason `send` is, and THROWING for the
    /// reason it is: what the port refuses, the seam repeats — and a refused stop must leave the
    /// vessel exactly as it found it.
    var stop: () throws -> Void = {}
    /// Put the Session on a rung (#545). Throwing, like `stop`: a refused rung changed nothing,
    /// and the seam is where the port's reason goes. Async besides, because the walk along the
    /// ring is (#653).
    var setMode: (SessionMode) async throws -> Void = { _ in }
    /// Every skill installed for this Project, read afresh each time the `/` menu opens (#685).
    /// The view holds only what this last answered, so no view reads the filesystem.
    var commands: () -> CommandCatalog = { CommandCatalog.empty }
    /// Every file in this Session's Workspace, read afresh each time the `@` menu opens (#687).
    /// ASYNC where `commands` is not: this one shells out to git over a tree that can hold a
    /// hundred thousand paths, and the composer must not wait on it.
    var files: () async -> [String] = { [] }
    @Binding var draft: ComposerDraft
    /// Holds the drag-over state open for a render — see `AttachmentDropTarget.isHeldOpen`.
    var isDropTargeted = false

    /// When this Session's composer came on screen — both the moment a restored draft's age is
    /// measured against and the test for whether it IS restored. Anything the user has typed since
    /// stamps later than this and takes the seam away.
    @State private var enteredAtMs = 0

    // The four below are the menus' own state and none survives one closing. Internal rather than
    // private because `SessionComposer+Menus` reads all four, and a SwiftUI extension can hold no
    // state of its own.

    /// The catalog as the last open read it, and where the keyboard is in the list it produced.
    @State var catalog = CommandCatalog.empty
    /// The Workspace tree as the last `@` read answered, and `nil` before it has answered at all.
    /// The read is asynchronous, so the two must not be one value: `[]` is a tree that was looked
    /// in and holds nothing, and "no file matches" may only be said about a tree that was read.
    @State var workspaceFiles: [String]?
    @State var cursor = ComposerMenuCursor()
    /// Whether Escape has put a menu away over a line that would still open one. Cleared by the
    /// next keystroke, because the reader typing again is them asking for it back.
    @State var isDismissed = false

    init(
        composer: SessionComposerProjection.Composer,
        send: @escaping ComposerSend,
        revoke: @escaping (String) -> Void = { _ in },
        lostTurnSeen: @escaping () -> Void = {},
        stop: @escaping () throws -> Void = {},
        setMode: @escaping (SessionMode) async throws -> Void = { _ in },
        commands: @escaping ()
            -> CommandCatalog = { CommandCatalog.empty },
        files: @escaping () async -> [String] = { [] },
        draft: Binding<ComposerDraft> = .constant(ComposerDraft()),
        isDropTargeted: Bool = false,
    ) {
        self.composer = composer
        self.send = send
        self.revoke = revoke
        self.lostTurnSeen = lostTurnSeen
        self.stop = stop
        self.setMode = setMode
        self.commands = commands
        self.files = files
        _draft = draft
        self.isDropTargeted = isDropTargeted
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            // Above the vessel in the stack rather than in an overlay over it: the whole composer
            // is anchored to the feed's bottom edge, so a row here grows UPWARD and the menu ends
            // up over the reading — which is where it belongs — with no offset to keep in step.
            commandMenu
            fileMenu
            if let note = seamNote {
                ComposerSeam(note: note, retry: retry)
            }
            vessel
        }
        .onChange(of: composer.sessionID, initial: true) { _, _ in
            enteredAtMs = WallClock.nowMs()
        }
        // The Turn the queue was waiting on has ended, so what was held goes, in the order it was
        // typed. `initial` is what makes it survive a switch: the composer is only on screen for
        // the SELECTED Session, so a Turn that ends while the reader is looking elsewhere changes
        // nothing here, and flushing on arrival delivers what was waiting.
        .onChange(of: composer.isRunning, initial: true) { _, isRunning in
            guard !isRunning else { return }
            draft.flush(via: send)
        }
        // A Turn the CLI never heard, put back where it was typed (#682). `initial` for the reason
        // the flush above has it: the news lands while the reader may be looking at another
        // Session, and it is still theirs when they come back to this one.
        .onChange(of: composer.lostTurn, initial: true) { _, lost in
            guard let lost, draft.turnLost(lost) else { return }
            lostTurnSeen()
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Composer")
    }

    private var vessel: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            if !composer.standingAllows.isEmpty {
                StandingAllowTray(allows: composer.standingAllows, revoke: revoke)
            }
            if !draft.attachments.isEmpty {
                AttachmentTray(attachments: draft.attachments) { draft.remove($0) }
            }
            queue
            ComposerField(text: $draft.text, placeholder: composer.placeholder, submit: submit)
                .onKeyPress(.downArrow) { walk { cursor.down(over: $0) } }
                .onKeyPress(.upArrow) { walk { cursor.up(over: $0) } }
            ComposerFooter(
                mode: composer.mode,
                facts: composer.facts,
                isSendable: draft.isSendable,
                isRunning: composer.isRunning,
                send: submit,
                stop: interrupt,
                attach: footerAttach,
                setMode: ask,
            )
        }
        // Asymmetric on purpose: the trailing edge ends in a 26pt control and the leading edge
        // in text, so the two are held off the rim by different amounts.
        .padding(.top, ArgoSpacing.comfortable)
        .padding(.leading, ArgoSpacing.loose)
        .padding(.trailing, ArgoSpacing.base)
        .padding(.bottom, ArgoSpacing.base)
        .argoFloatingGlass(in: RoundedRectangle(cornerRadius: ArgoRadius.popover))
        .modifier(AttachmentDropTarget(
            canAttach: composer.canAttach,
            attach: take,
            isHeldOpen: isDropTargeted,
        ))
        // Escape puts it away and leaves the draft exactly as it was. Not a mode: the next
        // keystroke asks for it back, because typing on is the reader still looking for a command.
        .onExitCommand { isDismissed = menu != nil || mentionMenu != nil }
        .onChange(of: draft.text) { was, _ in opened(was) }
        .onChange(of: composer.sessionID, initial: true) { _, _ in
            workspaceFiles = nil
            opened()
        }
        // The cursor settles on whatever the list IS, whenever it changes — not once when the line
        // opened it. The `@` tree is read asynchronously, so its rows arrive after that moment, and
        // a cursor settled over the empty list stayed nil: ⏎ then fell past both menus and sent the
        // half-typed line instead of picking the top row.
        .onChange(of: markedIDs, initial: true) { _, ids in cursor.settle(over: ids) }
    }

    /// An arrow key, and whether a menu took it. Unhandled where there is none, so the field's own
    /// caret movement is untouched on every line that opens nothing.
    private func walk(_ move: ([String]) -> Void) -> KeyPress.Result {
        let ids = markedIDs
        guard !ids.isEmpty else { return .ignored }
        move(ids)
        return .handled
    }

    /// The footer's `+`, and `nil` where the adapter takes nothing — which is what takes the
    /// control off the row rather than greying it (design decision 9).
    private var footerAttach: (([SessionAttachment]) -> Void)? {
        guard composer.canAttach else { return nil }
        return { incoming in take(incoming) }
    }

    /// What a drop, a paste and the `+` all end in — one act, so the three gestures cannot come to
    /// mean three different things. The capability is answered inside the draft rather than at each
    /// gesture, which is what lets a refused drop say why.
    private func take(_ incoming: [SessionAttachment]) {
        draft.attach(incoming, canAttach: composer.canAttach)
    }

    /// What is waiting on the running Turn, oldest at the top — the order they will go in, drawn
    /// as the order they are read in.
    @ViewBuilder private var queue: some View {
        if !draft.queued.isEmpty {
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                ForEach(draft.queued) { turn in
                    QueuedTurnChip(turn: turn) { draft.cancel(turn.id) }
                }
            }
            .padding(.bottom, ArgoSpacing.snug)
        }
    }

    /// Which of the seam's three sentences is up. The order is `ComposerSeamNote`'s.
    private var seamNote: ComposerSeamNote? {
        ComposerSeamNote.note(
            for: draft,
            enteredAtMs: enteredAtMs,
            modeDidNotTake: composer.modeDidNotTake,
        )
    }

    /// Sent now, or queued behind the Turn in flight — `ComposerDraft` owns which, so the field
    /// and the send control ask for the same thing.
    ///
    /// With the `/` menu up and a row under the cursor, ⏎ INSERTS instead (design decision 1): a
    /// command with arguments is the common case, and sending on ⏎ makes the argument impossible to
    /// type. Answered here rather than by an `onKeyPress` above the field, because a `TextField`
    /// takes Return itself and there is no intercepting it from outside.
    private func submit() {
        if let picked = cursor.row(in: menu?.rows ?? []) {
            return draft.take(picked.command)
        }
        if let picked = cursor.row(in: mentionMenu?.rows ?? []) {
            return take(mention: picked)
        }
        draft.submit(whileRunning: composer.isRunning, via: send)
    }

    /// Stop the Turn, and empty the composer behind it (#541, ADR-0024).
    ///
    /// The clearing happens HERE rather than off the Session going idle, and the order is what
    /// makes it work: the queue is emptied at the click, before the record catches up and the
    /// flush this view watches for fires. Waiting for the status to turn would be waiting for the
    /// exact moment the queued follow-ups are released.
    private func interrupt() {
        draft.stopped(via: stop)
    }

    /// Ask the Session for a rung. The control shows nothing of its own, so a refusal needs no
    /// undoing here.
    ///
    /// In a `Task` because the picker's setter cannot wait: the walk takes a keystroke per rung
    /// with a gap behind each (#653), and the note lands when it resolves.
    private func ask(for mode: SessionMode) {
        Task {
            do {
                try await setMode(mode)
                draft.modeAsked(refusedWith: nil)
            } catch {
                draft.modeAsked(refusedWith: error)
            }
        }
    }

    /// The seam's remedy, which is not the same act as pressing send: what it puts back is
    /// whatever the refusal stopped, and after a refused flush that is the queue, not the field.
    private func retry() {
        draft.retry(via: send)
    }
}
