/// What `AddButton` does to `ComposerMenus`, and what picking one of `AddMenu`'s rows opens
/// (design decision 11, `cockpit-composer-picker.md`, #689).
extension ComposerMenus {
    /// `AddButton` was clicked with nothing open — puts either sigil's listing away and opens
    /// `AddMenu` in its place.
    mutating func addOpened() {
        addState = .open
        isDismissed = false
    }

    /// `AddButton` was clicked again, or its row's pick already closed it — see
    /// `addMenuPicked(_:)`.
    mutating func addClosed() {
        addState = .closed
    }

    /// The `AddMenu` row the keyboard cursor is on, for ⏎ to take — `nil` where the menu is not
    /// open, which is what leaves ⏎ to `picked(on:)` on every other line.
    func addMenuPick(on line: ComposerMenuLine) -> ComposerMenu.AddRow? {
        guard addState == .open else { return nil }
        return ComposerMenu.addRows(on: line).first { $0.id == current }
    }

    /// A row of `AddMenu` was picked — by ⏎ or by a click, the one spelling of both (design
    /// decision 11). Puts `AddMenu` away and opens the SAME full listing typing the row's own
    /// sigil would, off the one catalog or tree both already share.
    @discardableResult mutating func addMenuPicked(_ row: ComposerMenu.AddRow) -> Asks {
        addState = .requested(row.sigil)
        isDismissed = false
        guard row.sigil == .command else {
            return Asks(generation: Generation(count: asked), commands: false, files: true)
        }
        asked += 1
        return Asks(generation: Generation(count: asked), commands: true, files: false)
    }

    /// The listing `AddMenu`'s own row asked for directly — the same derive `/` or `@` alone
    /// would open, off an empty query (design decision 11). `listing(on:)` is the one caller.
    ///
    /// `dropping` is forced to `0`: both derives compute it off the empty query as `1`, the sigil
    /// character they assume was typed — and here it never was, so a pick must drop nothing before
    /// inserting.
    func requestedListing(
        _ sigil: ComposerMenu.Sigil,
        on line: ComposerMenuLine,
    )
        -> ComposerMenu.Listing? {
        var listing: ComposerMenu.Listing? = if sigil == .command {
            ComposerMenu.commands(for: "/", in: catalog)
        } else if let workspaceFiles {
            ComposerMenu.files(for: "@", in: workspaceFiles, touched: line.touchedFiles)
        } else {
            nil
        }
        listing?.dropping = 0
        return listing
    }
}
