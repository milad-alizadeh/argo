import ArgoEngine

/// The control row under the field, assembled (#545, #558).
///
/// Its own file rather than a property on the view, for the reason `SessionComposer+Turn.swift`
/// is one: what the vessel's `body` is about is the STACK — the menu, the seam, the trays, the
/// field — and four controls' worth of wiring in the middle of it buries that shape.
extension SessionComposer {
    /// The footer's four controls, each assembled from the one place its reading comes from.
    ///
    /// A property rather than four arguments inline: what the row IS is `ComposerFooter`'s to say,
    /// and lifting the assembly out keeps this view's body about the vessel's stack.
    var footer: ComposerFooter {
        ComposerFooter(
            add: AddButtonControl(
                canAdd: !ComposerMenu.addRows(on: line).isEmpty,
                isOpen: menus.isAddMenuOpen,
                toggle: toggleAddMenu,
            ),
            mode: ModePickerControl(
                reading: composer.mode,
                heldMode: draft.heldMode,
                setMode: ask,
            ),
            runFacts: RunFactsControl(
                facts: composer.facts,
                acts: RunFactsActs(
                    setModel: askForModel,
                    setEffort: askForEffort,
                    reset: resetRunFacts,
                ),
                held: RunFactsHeld(model: draft.heldModel, effort: draft.heldEffort),
                isOpenForRender: opening == .runSettings,
            ),
            send: SendButtonControl(
                isSendable: draft.isSendable,
                // The status WORD, minus the one reading of it that is not the parent's own work
                // (#1267): a Turn held open by a handed-off child has nothing here to stop, and a
                // Stop drawn over it is the dead control this ticket was written from. The field
                // beside it already sends straight through at that reading, so a button still
                // saying Stop would answer Return with one act and the click with another.
                isRunning: composer.isRunning && !composer.isHeldByDelegation,
                send: submit,
                stop: interrupt,
            ),
        )
    }
}
