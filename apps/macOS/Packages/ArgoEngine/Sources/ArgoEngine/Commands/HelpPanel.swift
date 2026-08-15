/// The CLI's own built-in commands, read off the Commands tab of its `/help` panel (#686).
///
/// A pure function of the rendered screen, so a captured fixture holds the whole shape still.
enum HelpPanel {
    /// The commands the panel lists, in the order it lists them.
    ///
    /// Throws rather than answering short: a part of a catalogue is indistinguishable from a
    /// smaller one, and a picker that lists it denies commands the Session accepts.
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

    /// A name line opens a command and the line indented UNDER it describes it. Anything shallower
    /// belongs to neither — which is what keeps the panel's own closing sentences out of the last
    /// command's description, in the case where that command printed none.
    ///
    /// The panel indents a name by 5 and its description by 7, and closes with prose at 3. Compared
    /// rather than matched, because the three numbers are the CLI's and only their ORDER is a rule
    /// this can hold the CLI to.
    private static func commands(inList rows: [String]) -> [BuiltinCommand] {
        var read: [BuiltinCommand] = []
        var namedAt = 0
        for row in rows {
            if let name = row.commandName {
                namedAt = row.indent
                read.append(BuiltinCommand(name: name, description: nil))
            } else if row.indent > namedAt {
                read.describeLast(as: row.trimmed)
            }
        }
        return read
    }

    /// The one line that says the rows below it are the built-in commands.
    private static let heading = "Browse default commands"
}

private extension [BuiltinCommand] {
    /// Give the command still being read its description. Only the FIRST such line lands: the
    /// panel clamps to one line per command, so a second would be something else.
    mutating func describeLast(as description: String) {
        guard let open = last, open.description == nil, !description.isEmpty else { return }
        self[index(before: endIndex)] = BuiltinCommand(name: open.name, description: description)
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespaces)
    }

    /// How many spaces the panel holds this row off the edge by.
    var indent: Int {
        count - drop(while: \.isWhitespace).count
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
