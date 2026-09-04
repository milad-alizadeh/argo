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
                takesTypedLine: composer.takesTypedLine,
                isOpenForRender: opening == .runSettings,
            ),
            send: SendButtonControl(
                isSendable: draft.isSendable,
                isRunning: composer.isRunning,
                send: submit,
                stop: interrupt,
            ),
        )
    }
}
