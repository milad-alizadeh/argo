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
    /// Every skill installed for this Project, read afresh each time the `/` menu OPENS and never
    /// on the keystrokes after it (#685, #961). ASYNC for the reason `files` is, and for one more:
    /// it walks directories and decodes, and the actor that draws the caret does neither
    /// (ADR-0028 Rule 6). The view holds only what this last answered.
    var commands: () async -> CommandCatalog = { CommandCatalog.empty }
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

    /// Which menu the line has open and where the keyboard is in it. None of it survives a close.
    @State private var menus = ComposerMenus()

    init(
        composer: SessionComposerProjection.Composer,
        send: @escaping ComposerSend,
        revoke: @escaping (String) -> Void = { _ in },
        lostTurnSeen: @escaping () -> Void = {},
        stop: @escaping () throws -> Void = {},
        setMode: @escaping (SessionMode) async throws -> Void = { _ in },
        commands: @escaping () async
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
            menu
            if let note = seamNote {
                ComposerSeam(note: note, retry: retry)
            }
            vessel
        }
        .onChange(of: composer.sessionID, initial: true) { _, _ in
            enteredAtMs = WallClock.nowMs()
        }
        // What was waiting on the Turn goes — `SessionComposer.turnEnded()` owns the order.
        // `initial` is what makes it survive a switch: the composer is only on screen for the
        // SELECTED Session, so a Turn that ends while the reader is looking elsewhere changes
        // nothing here, and arriving is what delivers what was waiting, held rung included.
        .onChange(of: composer.isRunning, initial: true) { _, isRunning in
            guard !isRunning else { return }
            turnEnded()
        }
        // A rung held against a Turn that ended between the pick and the port's answer has no
        // boundary left to wait for, so the rung arriving is itself the trigger (#940).
        .onChange(of: draft.heldMode) { _, held in
            guard held != nil, !composer.isRunning else { return }
            turnEnded()
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
            if !draft.queued.isEmpty {
                QueuedTurnStack(turns: draft.queued) { draft.cancel($0) }
            }
            ComposerField(
                text: $draft.text,
                placeholder: composer.placeholder,
                submit: submit,
                walk: { menus.walk($0, on: line) },
                dismiss: { menus.dismissed(on: line) },
                attach: take,
            )
            ComposerFooter(
                mode: composer.mode,
                facts: composer.facts,
                isSendable: draft.isSendable,
                isRunning: composer.isRunning,
                send: submit,
                stop: interrupt,
                attach: footerAttach,
                heldMode: draft.heldMode,
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
        // Escape from anywhere else in the vessel. The field answers its own — it holds the
        // keyboard while a menu is open, and a text view takes the key before this ever sees it.
        .onExitCommand { menus.dismissed(on: line) }
        .onChange(of: draft.text) { was, _ in lineChanged(from: was) }
        .onChange(of: composer.sessionID, initial: true) { _, _ in
            read(menus.sessionChanged(to: line))
        }
        .onChange(of: menus.listing(on: line), initial: true) { _, _ in menus.settle(on: line) }
    }

    /// Sent now, or queued behind the Turn in flight — `ComposerDraft` owns which, so the field
    /// and the send control ask for the same thing.
    ///
    /// With a menu up and a row under the cursor, ⏎ INSERTS instead (design decision 1): a command
    /// with arguments is the common case, and sending on ⏎ makes the argument impossible to type.
    /// Answered here rather than by an `onKeyPress` above the field, because a `TextField` takes
    /// Return itself and there is no intercepting it from outside.
    private func submit() {
        if let picked = menus.picked(on: line) {
            return draft.take(picked)
        }
        draft.submit(whileRunning: composer.isRunning, via: sending)
    }

    /// Which of the seam's three sentences is up. The order is `ComposerSeamNote`'s.
    private var seamNote: ComposerSeamNote? {
        ComposerSeamNote.note(
            for: draft,
            enteredAtMs: enteredAtMs,
            modeDidNotTake: composer.modeDidNotTake,
        )
    }

    /// The line as the menus read it.
    private var line: ComposerMenuLine {
        ComposerMenuLine(draft.text, on: composer)
    }

    /// The open menu takes the vessel's own width, because the description is the content: at any
    /// stated width two thirds of a real `description:` would be an ellipsis.
    ///
    /// The gap above the vessel is the design's `base` less what the stack already contributes,
    /// spelled as the arithmetic so moving either step keeps the gap.
    @ViewBuilder private var menu: some View {
        if let listing = menus.listing(on: line) {
            ComposerMenuList(listing: listing, current: menus.current) {
                draft.take(listing.pick($0))
            }
            .padding(.bottom, ArgoSpacing.base - ArgoSpacing.tight)
        }
    }

    private func lineChanged(from was: String) {
        read(menus.lineChanged(from: was, to: line))
    }

    /// Whatever the line has just opened, asked for and never waited on — so a hundred-thousand
    /// path tree lists behind a composer that stayed typeable throughout, and the skills walk
    /// happens somewhere other than the thread drawing the caret.
    private func read(_ reads: ComposerMenus.Reads) {
        if reads.commands {
            Task { await menus.commandsAnswered(commands()) }
        }
        if reads.files {
            Task { await menus.workspaceAnswered(files()) }
        }
    }
}
