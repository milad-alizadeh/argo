/// What `AddButton` and `AddMenu` do to the vessel (design decision 11,
/// `cockpit-composer-picker.md`, #689).
extension SessionComposer {
    /// `AddButton` was clicked.
    func toggleAddMenu() {
        guard !menus.isAddMenuOpen else { return menus.addClosed() }
        menus.addOpened()
        menus.settle(on: line)
    }

    /// A row of `AddMenu` was picked — by ⏎ or by a click. The cursor settles through the same
    /// `onChange(of: menus.listing(on:))` a typed sigil's own opening does — `listing(on:)` goes
    /// from `nil` (`AddMenu` was open) to the requested one this puts up.
    func open(_ row: ComposerMenu.AddRow) {
        read(menus.addMenuPicked(row))
    }

    /// What `opening` asks for, done the one time it can matter — see the doc comment on the
    /// property itself.
    func applyOpening() {
        switch opening {
        // Neither opens a menu of the LINE: `closed` opens nothing, and the run settings are the
        // footer's own popover, which `ComposerFooter` is handed the flag for directly.
        case .closed, .runSettings:
            return
        case .addMenu:
            menus.addOpened()
            menus.settle(on: line)
        case .files:
            openRequested(rowID: "files")
        case .commands:
            openRequested(rowID: "commands")
        }
    }

    private func openRequested(rowID: String) {
        guard let row = ComposerMenu.addRows(on: line).first(where: { $0.id == rowID }) else {
            return
        }
        read(menus.addMenuPicked(row))
    }
}
