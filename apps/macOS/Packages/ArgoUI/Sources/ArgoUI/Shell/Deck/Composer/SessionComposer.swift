import ArgoAtoms
import ArgoDesign
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
package struct SessionComposer: View {
    let composer: SessionComposerProjection.Composer
    /// What the vessel's controls do — the deck's own value, the one the feed already holds. The
    /// composer reads the acts it draws a control for; `decide` and `spawnBeside` belong to the
    /// other two vessels in the same slot.
    let intents: DeckIntents
    @Binding var draft: ComposerDraft
    /// Holds the drag-over state open for a render — see `AttachmentDropTarget.isHeldOpen`.
    var isDropTargeted = false

    /// When this Session's composer came on screen — both the moment a restored draft's age is
    /// measured against and the test for whether it IS restored. Anything the user has typed since
    /// stamps later than this and takes the seam away.
    @State private var enteredAtMs = 0

    /// Which menu the line has open and where the keyboard is in it. None of it survives a close.
    /// Not `private`: `SessionComposer+Add.swift` mutates it too, and Swift's `private` is
    /// file-scoped — the same reason `composer`, `draft` and `intents` above aren't either.
    @State var menus = ComposerMenus()
    /// What `menus` should already show the instant this View appears — a Specimen's own hook
    /// (#689). Production always passes `.closed`: every render that opens something does it
    /// through the click or keystroke a reader would, never through this seam. Not `private`, for
    /// the reason `menus` isn't.
    let opening: ComposerMenusOpening

    package init(
        composer: SessionComposerProjection.Composer,
        intents: DeckIntents = .inert,
        isDropTargeted: Bool = false,
        opening: ComposerMenusOpening = .closed,
    ) {
        self.composer = composer
        self.intents = intents
        // The one binding among the intents, unwrapped so the vessel below reads and writes the
        // draft the way every other SwiftUI surface does.
        _draft = intents.draft
        self.isDropTargeted = isDropTargeted
        self.opening = opening
    }

    package var body: some View {
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
            guard let lost, draft.turnLost(lost, whileRunning: composer.isRunning)
            else { return }
            intents.lostTurnSeen()
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Composer")
    }

    private var vessel: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            if !composer.standingAllows.isEmpty {
                StandingAllowTray(allows: composer.standingAllows, revoke: intents.revoke)
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
                complete: complete,
                attach: take,
            )
            footer
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
            // In the SAME pass as the line above, and never a second `onChange`: `sessionChanged`
            // itself puts `opening` away (design decision 9's rule read for this seam — a fresh
            // arrival opens nothing until asked), so applying it after is what makes it stick.
            applyOpening()
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
    ///
    /// What a menu makes of the key is `complete()` below, which ⇥ asks the same question of —
    /// that includes `AddMenu`, where a pick OPENS the row's section rather than inserting
    /// anything (design decision 11), the same act a click makes; see `open(_:)`.
    /// Not `private`, for the reason `menus` is not: `SessionComposer+Footer.swift` hands this to
    /// the send control.
    func submit() {
        guard !complete() else { return }
        draft.submit(whileRunning: composer.isRunning, via: sending)
    }

    /// Tab, which takes the row under the cursor exactly as ⏎ does over the same menu (#1181) —
    /// the completion key every other such menu answers, and the one the hand reaches for.
    ///
    /// It is the WHOLE of what ⏎ does over a menu, called by both keys rather than spelled twice:
    /// two lists of what a pick means could drift, and a Tab that took a different row from the ⏎
    /// beside it is the one way this could be worse than not answering Tab at all.
    ///
    /// Over `AddMenu` it OPENS the row's section, which is that menu's own meaning of a pick
    /// (design decision 11): its rows insert nothing to be taken. Tab cannot simply decline there
    /// either — a Tab that walked focus away would leave the drawer drawn with a keyboard cursor
    /// the arrows no longer reach.
    ///
    /// `false` is what leaves Tab alone, and the field walks focus with it as #718 built: there is
    /// no menu at all, or the filter matched nothing and there is no row under the cursor to take
    /// (design decision 8). It is also what sends the Turn, since ⏎ asks the same question.
    private func complete() -> Bool {
        if let row = menus.addMenuPick(on: line) {
            open(row)
            return true
        }
        guard let picked = menus.picked(on: line) else { return false }
        draft.take(picked)
        return true
    }

    /// Which of the seam's three sentences is up. The order is `ComposerSeamNote`'s.
    private var seamNote: ComposerSeamNote? {
        ComposerSeamNote.note(
            for: draft,
            enteredAtMs: enteredAtMs,
            modeDidNotTake: composer.modeDidNotTake,
        )
    }

    /// The line as the menus read it. Not `private`, for the reason `menus` isn't.
    var line: ComposerMenuLine {
        ComposerMenuLine(draft.text, on: composer)
    }

    /// The open menu takes the vessel's own width, because the description is the content: at any
    /// stated width two thirds of a real `description:` would be an ellipsis.
    ///
    /// The gap above the vessel is the design's `base` less what the stack already contributes,
    /// spelled as the arithmetic so moving either step keeps the gap.
    @ViewBuilder private var menu: some View {
        if menus.isAddMenuOpen {
            AddMenu(rows: ComposerMenu.addRows(on: line), current: menus.current, pick: open)
                .padding(.bottom, ArgoSpacing.base - ArgoSpacing.tight)
        } else if let listing = menus.listing(on: line) {
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
    ///
    /// The skills answer carries the token it was asked with, so a read overtaken by a later one
    /// or by a Session change lands nowhere. Not `private`, for the reason `menus` isn't.
    func read(_ asks: ComposerMenus.Asks) {
        if asks.commands {
            Task { await menus.commandsAnswered(intents.commands(), to: asks.generation) }
        }
        if asks.files {
            Task { await menus.workspaceAnswered(intents.files()) }
        }
    }
}
