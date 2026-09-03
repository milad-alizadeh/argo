import ArgoEngine

/// What `ComposerMenus` should already show the instant `SessionComposer` appears — a Specimen's
/// own hook (#689), and `SessionComposer.applyOpening()` its one reader. Production always passes
/// `.closed`, the default: every render that opens something does it through the click or
/// keystroke a reader would, never through this seam.
package enum ComposerMenusOpening {
    case closed
    /// `AddMenu` itself, the two-row drawer.
    case addMenu
    /// The full listing picking `AddMenu`'s Files row would open — the same one `@` does.
    case files
    /// The full listing picking `AddMenu`'s Skills & commands row would open — the same one `/`
    /// does.
    case commands
    /// The run-settings popover the footer's fact line opens (#558). Not a menu of the LINE like
    /// the three above — nothing about it reads the draft — but it is the composer's other thing
    /// that opens, and a Specimen reaches every one of them through this one hook.
    case runSettings
}

/// Which menu the composer's line has open, where the keyboard is in it, and what each event does
/// to both — `/` and `@` (#685, #687, #752).
///
/// A value holds no `Task`, so both reads stay the view's: each is ASKED FOR by the event that
/// opens a menu and comes back through an `answered` method (#961).
struct ComposerMenus {
    /// Which question an answer is answering. Opaque, and only `ComposerMenus` makes one: an
    /// answer to a read that a later read or a Session change has overtaken lands nowhere. Not
    /// `fileprivate`: `ComposerMenus+Add.swift` stamps one too, for the reason `isAddOpen` isn't
    /// `private`.
    struct Generation: Equatable {
        let count: Int
    }

    /// What a line change asks to be read. Each half is asked for on the OPENING of its menu and
    /// never on the keystrokes after it: neither the skills on disk nor the Workspace tree changes
    /// while a word is being typed into the line (#961).
    struct Asks: Equatable {
        /// What `commandsAnswered` must carry back for its answer to land.
        let generation: Generation
        var commands = false
        var files = false
    }

    /// The catalog as the last `/` OPENING read it, and `nil` before it has answered at all — the
    /// `@` tree's rule, for the `@` tree's reason: "no skill matches" is a statement about a
    /// catalog, and there is none here to have looked in. A skill installed while the Session was
    /// up lands in the very next list, because opening the menu is what re-reads. No watcher, no
    /// restart, and nothing on the keystrokes between.
    /// Not `private`, for the reason `isAddOpen` is not: `requestedListing(_:on:)` in
    /// `ComposerMenus+Add.swift` reads it too.
    var catalog: CommandCatalog?
    /// The Workspace tree as the last `@` read answered, and `nil` before it has answered at all.
    /// The read is asynchronous, so the two must not be one value: `[]` is a tree that was looked
    /// in and holds nothing, and "no file matches" may only be said about a tree that was read.
    /// Not `private`, for the same reason `catalog` is not.
    var workspaceFiles: WorkspaceTree?
    /// Stays `private`, unlike its neighbours below: `addMenuPick(on:)` reads the cursor through
    /// `current` instead, which is what keeps ONE stored property sealing this struct's
    /// synthesized memberwise init — edge 6 skips a sealed one rather than counting it, and every
    /// other field here had to stop being `private` for `ComposerMenus+Add.swift` to reach it.
    private var cursor = ComposerMenuCursor()
    /// How many skills reads have been asked for. The count IS the token: a read asked for before
    /// the last one is answering a question nobody has any more. Not `private`, for the reason
    /// `cursor` isn't.
    var asked = 0
    /// Whether Escape has put a menu away over a line that would still open one. Not `private`,
    /// for the reason `cursor` isn't.
    var isDismissed = false
    /// `AddButton`'s own two states, beside either sigil's listing (design decision 11, #689). At
    /// most one of the three ever stands: opening `AddMenu`, or requesting a sigil's listing off
    /// one of its rows, puts the sigil-typed derive and the other state away — ONE value rather
    /// than an `isAddOpen` flag beside a `requested: Sigil?` that could otherwise both be set.
    ///
    /// Not `private`: the rules that open and pick off it live in `ComposerMenus+Add.swift`, and
    /// Swift's `private` is file-scoped — the same reason `ComposerDraft.attachments` isn't one.
    enum AddState: Equatable {
        case closed
        /// `AddMenu` itself, the two-row drawer.
        case open
        /// The sigil `AddMenu` asked for DIRECTLY, off one of its rows — set by
        /// `addMenuPicked(_:)` rather than by typing the sigil: the field stays exactly as the
        /// reader left it, and the listing behind it is the same untyped one `/` or `@` alone
        /// would open — `ComposerMenu.commands(for: "/", in:)`,
        /// `ComposerMenu.files(for: "@", in:touched:)`.
        case requested(ComposerMenu.Sigil)
    }

    var addState = AddState.closed

    /// The menu the line opens, and `nil` where none does — `AddMenu` while it is open, else
    /// whichever sigil's listing.
    ///
    /// At most one of the two sigils is ever open, and by construction rather than by a guard: `/`
    /// opens only at the head of the line, `@` only on a token the reader is still typing. So the
    /// `/` derive is asked first and the `@` derive answers whatever it declined.
    func listing(on line: ComposerMenuLine) -> ComposerMenu.Listing? {
        guard !isDismissed else { return nil }
        switch addState {
        case .closed: return commandListing(on: line) ?? fileListing(on: line)
        case .open: return nil
        case let .requested(sigil): return requestedListing(sigil, on: line)
        }
    }

    /// Whether `AddMenu` itself — the two-row drawer, not either sigil's full listing — is open.
    var isAddMenuOpen: Bool {
        addState == .open
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
        let hadAddOpen = addState == .open
        let hadListing = !hadAddOpen && listing(on: line) != nil
        addState = .closed
        isDismissed = hadListing
        return hadAddOpen || hadListing
    }

    /// What the line has just opened, and what that asks to be read — the caller owns both awaits,
    /// and the answers come back through `commandsAnswered` and `workspaceAnswered`.
    ///
    /// Each read is asked for on the token OPENING rather than on every keystroke, because neither
    /// the Workspace tree nor the skills on disk changes while a word is being typed into the line
    /// (#961). A keystroke inside a `/` line therefore reads nothing at all — including the space
    /// or second slash that closes the menu without the reader having left the command.
    @discardableResult mutating func lineChanged(
        from was: String,
        to line: ComposerMenuLine,
    )
        -> Asks {
        let wasDismissed = isDismissed
        isDismissed = false
        // Typing means the reader has moved from browsing `AddMenu` — or a requested full listing
        // it opened — to writing, so it closes. A pick's own insertion fires this too, which is
        // exactly what is meant to close it: see `addMenuPicked(_:)`.
        addState = .closed
        // The HEAD of the previous line, and not `ComposerMenu.command(in:)`'s full rule: a space
        // or a second slash closes the menu without the reader having left the command they are
        // typing, and re-reading on those made a held-down space a walk every second keystroke.
        let reopened = wasDismissed || !was.hasPrefix("/")
        return asking(commands: opensCommands(line) && reopened, on: line, from: was)
    }

    /// The composer has been pointed at another Session, whose Workspace and skills this one knows
    /// nothing about — so both go, and the line is opened afresh against the new one.
    ///
    /// The skills are asked for whatever the line says, because the composer ARRIVING is itself an
    /// opening: read now and the menu has its rows before the reader has typed the `/`.
    @discardableResult mutating func sessionChanged(to line: ComposerMenuLine) -> Asks {
        workspaceFiles = nil
        catalog = nil
        isDismissed = false
        addState = .closed
        // Whatever was in flight for the last Session is an answer to nobody's question now.
        asked += 1
        return asking(commands: line.canRunCommands, on: line, from: "")
    }

    /// The `/` read has answered, with whatever the skills directories held when it was asked.
    /// An answer to an overtaken read is dropped: two menus opened in quick succession would
    /// otherwise race, and a read in flight across a Session change would land the last Project's
    /// catalog on this one.
    mutating func commandsAnswered(_ read: CommandCatalog, to generation: Generation) {
        guard generation == Generation(count: asked) else { return }
        catalog = read
    }

    /// The `@` read has answered. The tree is prepared here rather than by the caller, so the cost
    /// of folding a hundred thousand paths is paid once per open and nowhere else.
    mutating func workspaceAnswered(_ paths: [String]) {
        workspaceFiles = WorkspaceTree(paths)
    }

    /// One place the token is stamped, so a read can never be asked for without one.
    private mutating func asking(
        commands: Bool,
        on line: ComposerMenuLine,
        from was: String,
    )
        -> Asks {
        if commands {
            asked += 1
        }
        return Asks(
            generation: Generation(count: asked),
            commands: commands,
            files: ComposerMenu.mention(in: line.text) != nil
                && ComposerMenu.mention(in: was) == nil,
        )
    }

    /// The ids of whichever menu is open, in drawing order — what the cursor walks and what ⏎ picks
    /// out of, so neither can fall out of step with the list on screen.
    private func ids(on line: ComposerMenuLine) -> [String] {
        guard addState != .open else { return ComposerMenu.addRows(on: line).map(\.id) }
        return listing(on: line)?.rows.map(\.id) ?? []
    }

    /// `nil` for an adapter that declares no command surface, or a line that is not a command. A
    /// catalog that has not answered yet is a listing and not a `nil`: see `ComposerMenu.commands`.
    private func commandListing(on line: ComposerMenuLine) -> ComposerMenu.Listing? {
        guard line.canRunCommands else { return nil }
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
