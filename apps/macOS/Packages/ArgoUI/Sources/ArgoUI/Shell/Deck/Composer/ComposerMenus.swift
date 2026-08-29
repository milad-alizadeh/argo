import ArgoEngine

/// Which menu the composer's line has open, where the keyboard is in it, and what each event does
/// to both — `/` and `@` (#685, #687, #752).
///
/// A value holds no `Task`, so both reads stay the view's: each is ASKED FOR by the event that
/// opens a menu and comes back through an `answered` method (#961).
struct ComposerMenus {
    /// What a line change asks to be read again. Both halves are asked for on the OPENING of their
    /// menu and never on the keystrokes after it: neither the skills on disk nor the Workspace tree
    /// changes while a word is being typed into the line (#961).
    struct Reads: Equatable {
        var commands = false
        var files = false
    }

    /// The catalog as the last `/` OPENING read it, and `nil` before it has answered at all — the
    /// `@` tree's rule, for the `@` tree's reason: "no skill matches" is a statement about a
    /// catalog, and there is none here to have looked in. A skill installed while the Session was
    /// up lands in the very next list, because opening the menu is what re-reads. No watcher, no
    /// restart, and nothing on the keystrokes between.
    private var catalog: CommandCatalog?
    /// The Workspace tree as the last `@` read answered, and `nil` before it has answered at all.
    /// The read is asynchronous, so the two must not be one value: `[]` is a tree that was looked
    /// in and holds nothing, and "no file matches" may only be said about a tree that was read.
    private var workspaceFiles: WorkspaceTree?
    private var cursor = ComposerMenuCursor()
    /// Whether Escape has put a menu away over a line that would still open one.
    private var isDismissed = false

    /// The menu the line opens, and `nil` where none does.
    ///
    /// At most one is ever open, and by construction rather than by a guard: `/` opens only at the
    /// head of the line, `@` only on a token the reader is still typing. So the `/` derive is asked
    /// first and the `@` derive answers whatever it declined.
    func listing(on line: ComposerMenuLine) -> ComposerMenu.Listing? {
        guard !isDismissed else { return nil }
        return commandListing(on: line) ?? fileListing(on: line)
    }

    /// The row the keyboard is on, for the list to ink.
    var current: String? {
        cursor.current
    }

    /// Put the cursor on whatever the list IS, whenever it changes — not once when the line opened
    /// it. The `@` tree is read asynchronously, so its rows arrive after that moment, and a cursor
    /// settled over the empty list stayed nil: ⏎ then fell past both menus and sent the half-typed
    /// line instead of picking the top row.
    mutating func settle(on line: ComposerMenuLine) {
        cursor.settle(over: ids(on: line))
    }

    /// An arrow key, and whether a menu took it. `false` where there is none, so the field's own
    /// caret movement is untouched on every line that opens nothing.
    mutating func walk(_ key: ComposerKeyIntent, on line: ComposerMenuLine) -> Bool {
        let ids = ids(on: line)
        guard !ids.isEmpty else { return false }
        switch key {
        case .walkDown: cursor.down(over: ids)
        case .walkUp: cursor.up(over: ids)
        case .submit, .newline, .dismiss, .pass: return false
        }
        return true
    }

    /// What ⏎ takes out of the open menu, and `nil` where it takes nothing — which is what leaves
    /// the empty state's Return to the field, so a line nothing matched still sends as written
    /// (design decision 8). The one spelling of the pick: the row tap asks the same listing.
    func picked(on line: ComposerMenuLine) -> ComposerMenu.Pick? {
        guard let listing = listing(on: line), let row = cursor.row(in: listing) else { return nil }
        return listing.pick(row)
    }

    /// Escape puts an open menu away and leaves the draft exactly as it was. Not a mode: the next
    /// keystroke asks for it back, because typing on is the reader still looking for a command.
    ///
    /// It answers whether it DID anything, because the field holds the keyboard: an Escape this
    /// swallowed with no menu open is an Escape the permission footer's `esc denies` never sees.
    @discardableResult mutating func dismissed(on line: ComposerMenuLine) -> Bool {
        isDismissed = listing(on: line) != nil
        return isDismissed
    }

    /// What the line has just opened, and what that asks to be read again — the caller owns both
    /// awaits, and the answers come back through `commandsAnswered` and `workspaceAnswered`.
    ///
    /// Each read is asked for on the token OPENING rather than on every keystroke, because neither
    /// the Workspace tree nor the skills on disk changes while a word is being typed into the line.
    /// The `/` half is what #961 was: every character of a command name walked the skills
    /// directories and decoded two JSON files, on the thread that draws the caret.
    @discardableResult mutating func lineChanged(
        from was: String,
        to line: ComposerMenuLine,
    )
        -> Reads {
        isDismissed = false
        return Reads(
            commands: opensCommands(line) && ComposerMenu.command(in: was) == nil,
            files: ComposerMenu.mention(in: line.text) != nil
                && ComposerMenu.mention(in: was) == nil,
        )
    }

    /// The composer has been pointed at another Session, whose Workspace and skills this one knows
    /// nothing about — so both go, and the line is opened afresh against the new one.
    @discardableResult mutating func sessionChanged(to line: ComposerMenuLine) -> Reads {
        workspaceFiles = nil
        catalog = nil
        return lineChanged(from: "", to: line)
    }

    /// The `/` read has answered, with whatever the skills directories held at the moment the menu
    /// opened.
    mutating func commandsAnswered(_ read: CommandCatalog) {
        catalog = read
    }

    /// The `@` read has answered. The tree is prepared here rather than by the caller, so the cost
    /// of folding a hundred thousand paths is paid once per open and nowhere else.
    mutating func workspaceAnswered(_ paths: [String]) {
        workspaceFiles = WorkspaceTree(paths)
    }

    /// The ids of whichever menu is open, in drawing order — what the cursor walks and what ⏎ picks
    /// out of, so neither can fall out of step with the list on screen.
    private func ids(on line: ComposerMenuLine) -> [String] {
        listing(on: line)?.rows.map(\.id) ?? []
    }

    /// `nil` for an adapter that declares no command surface, a line that is not a command, or a
    /// catalog that has not answered yet — `fileListing`'s rule, and its reason.
    private func commandListing(on line: ComposerMenuLine) -> ComposerMenu.Listing? {
        guard line.canRunCommands, let catalog else { return nil }
        return ComposerMenu.commands(for: line.text, in: catalog)
    }

    /// Offered on one condition less: naming a file is Argo's own act, so it is offered wherever
    /// there is a Workspace to name one in — including a `codex` Session, which declares no command
    /// surface and gets no `/` menu at all (design decision 14).
    private func fileListing(on line: ComposerMenuLine) -> ComposerMenu.Listing? {
        // No Workspace, no menu — not an empty one. "No file matches" is a statement about a tree,
        // and there is no tree here to have looked in. A read still in flight is the same case:
        // `workspaceFiles` is nil until it answers, so the zero line cannot speak for a tree first.
        guard line.workspaceRoot != nil, let workspaceFiles else { return nil }
        return ComposerMenu.files(
            for: line.text,
            in: workspaceFiles,
            touched: line.touchedFiles,
        )
    }

    private func opensCommands(_ line: ComposerMenuLine) -> Bool {
        line.canRunCommands && ComposerMenu.command(in: line.text) != nil
    }
}
