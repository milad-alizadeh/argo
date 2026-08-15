/// The CLI's own built-in commands, read off the Commands tab of its `/help` panel (#686).
///
/// Argo keeps no list of command names, because a list kept here fails HARD: a name it is missing
/// is the picker lying about what the Session accepts, and nothing on this side would ever notice.
/// Asking the CLI moves that risk onto the CURATION, which fails soft — see `BuiltinCuration`.
///
/// A pure function of the rendered screen. What renders it is a port, so the whole of the shape
/// this reads is something a captured fixture can hold still.
enum HelpPanel {
    /// The commands the panel lists, in the order it lists them.
    ///
    /// Throws rather than answering short. Every failure here has the same shape — the reader saw
    /// only part of the panel — and a part of a catalogue is indistinguishable from a smaller one.
    static func commands(on screen: [String]) throws -> [BuiltinCommand] {
        let rows = try list(in: screen)
        let read = commands(inList: rows)
        guard !read.isEmpty else { throw HelpPanelError.noCommandList }
        return read
    }

    /// Whether the panel is on this screen at all — what a reader driving the CLI checks between
    /// attempts, before there is anything worth parsing.
    static func isOpen(on screen: [String]) -> Bool {
        screen.contains { $0.trimmed == heading }
    }

    /// The lines between the list's own heading and whatever ends it, and nothing outside them.
    private static func list(in screen: [String]) throws -> [String] {
        guard let opens = screen.firstIndex(where: { $0.trimmed == heading }) else {
            throw HelpPanelError.noCommandList
        }
        let rows = screen[screen.index(after: opens)...]
        // Checked over the LIST rather than the whole screen: the marker is a glyph, and the
        // reader's own prompt or a command's description could carry one of its own.
        guard !rows.contains(where: \.carriesScrollMarker) else { throw HelpPanelError.truncated }
        return Array(rows)
    }

    /// A name line opens a command and the indented line under it describes it. Anything else —
    /// the blank rows around the list, the two closing sentences — belongs to neither.
    private static func commands(inList rows: [String]) -> [BuiltinCommand] {
        rows.reduce(into: []) { read, row in
            guard let name = row.commandName else { return read.append(description: row.trimmed) }
            read.append(BuiltinCommand(name: name, description: nil))
        }
    }

    /// The one line that says the rows below it are the built-in commands.
    private static let heading = "Browse default commands"
}

/// Why nothing was read. Both cases mean the same thing to a caller — the built-in half is
/// unavailable — and are kept apart because only one of them says to try a taller terminal.
enum HelpPanelError: Error, Equatable {
    /// The panel stopped mid-list, so the rows below the last drawn one were never on screen.
    case truncated
    /// No command list was on the screen at all.
    case noCommandList
}

private extension [BuiltinCommand] {
    /// Give the command still being read its description, and ignore a line belonging to no
    /// command at all. Only the FIRST such line lands: the panel clamps to one line per command,
    /// so a second would be the closing prose rather than more of the description.
    mutating func append(description: String) {
        guard let open = last, open.description == nil, !description.isEmpty else { return }
        self[index(before: endIndex)] = BuiltinCommand(name: open.name, description: description)
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespaces)
    }

    /// The name a row invokes, without its slash, and `nil` where the row names no command. The
    /// indent is not part of the test: a row carrying the scroll marker is drawn one column left of
    /// its neighbours, and the list has already been refused by the time that matters.
    var commandName: String? {
        let trimmed = trimmed
        guard trimmed.hasPrefix("/"), !trimmed.contains(" ") else { return nil }
        return String(trimmed.dropFirst())
    }

    /// Whether this row says the list goes on past the panel's edge.
    var carriesScrollMarker: Bool {
        contains("↓") || contains("↑")
    }
}
