import ArgoEngine

/// Where the `/` menu opens, what is in it, and in what order (design decisions 2, 3 and 4).
extension ComposerMenu {
    /// The listing for a line, or `nil` where the line opens none.
    ///
    /// A `nil` catalog is the walk still in flight, which is a listing of its own rather than no
    /// listing: a menu that vanished until the directories answered would read as the composer
    /// refusing the line, and ⏎ would send the half-typed line meanwhile.
    static func commands(for text: String, in catalog: CommandCatalog?) -> Listing? {
        guard let query = command(in: text) else { return nil }
        guard let catalog else { return reading(query) }
        return Listing(
            sections: sections(of: catalog.commands, matching: query),
            query: query,
            sigil: .command,
            status: status(of: catalog.builtins),
            dropping: query.count + 1,
        )
    }

    /// The surface over a line whose skills have not answered. No rows, one strip saying they are
    /// coming, and no zero line — see `Listing.isReading`.
    private static func reading(_ query: String) -> Listing {
        Listing(
            sections: [],
            query: query,
            sigil: .command,
            status: Status(words: readingSkills, mark: .waiting),
            isReading: true,
            dropping: query.count + 1,
        )
    }

    /// What the reader has typed after the `/`, and `nil` where there is no `/` to be after.
    ///
    /// Three rules, all decision 2's. **At any token boundary** — the head of the draft, the head
    /// of a later line, or after a space, the same rule `mention(in:)` uses for `@` (#1256).
    /// **Closed by the first space** — that is what says the command is settled and its arguments
    /// have begun, and it is the whole of what makes `slash-args.png` a sendable line rather than
    /// a menu standing over one. **Closed by a second slash**, because a second one means a path:
    /// the design names `/usr/local` as the line that opens nothing, and no command carries a
    /// slash in its name.
    ///
    /// The LAST such token, because that is the one being typed — `mention(in:)`'s own reason.
    static func command(in text: String) -> String? {
        guard let slash = text.lastIndex(of: "/"), opensToken(text, at: slash) else { return nil }
        let typed = text[text.index(after: slash)...]
        guard !typed.contains(where: \.isWhitespace), !typed.contains("/") else { return nil }
        return String(typed)
    }

    /// The range of the command name the CLI will actually run as one, or `nil` where the draft
    /// opens with none — the answer to #1256's open question. `command(in:)` finds whichever `/`
    /// token the reader is CURRENTLY typing, anywhere a token boundary allows one; this looks only
    /// at index 0, because the CLI reads the whole draft as one prompt and runs it as a command
    /// only when a `/` name starts the draft. `/prototype-to-design` two lines down opens the menu
    /// so the reader can still complete it, but it is never what this returns, and the field must
    /// not colour it as a command that will run.
    ///
    /// The mark stands past the first space, unlike `command(in:)`: `/implement 745 ` is still the
    /// command `implement` with an argument after it, not a settled line with nothing to mark.
    static func commandMark(in text: String) -> Range<String.Index>? {
        guard text.hasPrefix("/") else { return nil }
        let head = text.index(after: text.startIndex)
        let name = text[head...].prefix { !$0.isWhitespace }
        guard !name.isEmpty, !name.contains("/") else { return nil }
        return text.startIndex ..< name.endIndex
    }

    /// The word an origin goes by. Upper-casing is the badge's own, because it is a face and not a
    /// fact.
    static func word(for origin: CommandOrigin) -> String {
        switch origin {
        case .project: "Project"
        case .user: "Global"
        case .plugin: "Plugin"
        case .claudeCode: "Claude Code"
        }
    }

    /// The strip above the list, and `nil` where there is nothing to say — a strip saying the list
    /// is complete is a line the reader re-reads to learn nothing.
    private static func status(of builtins: BuiltinStatus) -> Status? {
        switch builtins {
        case .read: nil
        case .reading: Status(words: readingBuiltins, mark: .waiting)
        case .unavailable: Status(words: builtinsUnavailable, mark: .failed)
        }
    }

    private static func sections(of catalog: [Command], matching query: String) -> [Section] {
        guard !query.isEmpty else { return byOrigin(catalog) }
        return byMatch(catalog, on: query.lowercased())
    }

    /// Nothing typed yet: one section per origin, nearest first, each saying where it read from and
    /// how many it found. The catalog already answers in that order, so the runs are consecutive.
    private static func byOrigin(_ catalog: [Command]) -> [Section] {
        runs(of: catalog).map { origin, commands in
            Section(
                id: origin.readFrom,
                label: word(for: origin),
                detail: "\(origin.readFrom) · \(commands.count)",
                rows: commands.map { row(for: $0, matched: 0 ..< 0, origin: nil) },
            )
        }
    }

    private static func runs(of catalog: [Command]) -> [(CommandOrigin, [Command])] {
        catalog.reduce(into: []) { runs, command in
            guard runs.last?.0 == command.origin else { return runs.append((
                command.origin,
                [command],
            )) }
            runs[runs.count - 1].1.append(command)
        }
    }

    /// Filtering narrows AND reorders (decision 3): every prefix match first, in origin order, then
    /// the ones that merely contain the characters under their own header. A good match therefore
    /// never slides down the list as the reader types. Origin moves onto the rows, because the
    /// sections no longer group by it.
    private static func byMatch(_ catalog: [Command], on query: String) -> [Section] {
        var opening: [Row] = []
        var containing: [Row] = []
        for command in catalog {
            guard let matched = match(query, in: command.command) else { continue }
            let row = row(for: command, matched: matched, origin: word(for: command.origin))
            if opens(matched, of: command) {
                opening.append(row)
            } else {
                containing.append(row)
            }
        }
        return [
            Section(id: "opening", label: nil, detail: nil, rows: opening),
            Section(
                id: "containing",
                label: alsoContains,
                detail: "\"\(query)\" · \(containing.count)",
                rows: containing,
            ),
        ].filter { !$0.rows.isEmpty }
    }

    /// Whether a match is at the head of the thing the reader is naming. TWO heads, because a
    /// plugin's command is `/plugin:name` and the reader typing `simplify` has named the command
    /// exactly — ranked only off the command's own start, every plugin command would file under
    /// "Also contains" no matter how well it matched.
    private static func opens(_ matched: Range<Int>, of command: Command) -> Bool {
        matched.lowerBound == 1 || matched.lowerBound == command.command.count - command.name.count
    }

    /// The header over the weaker half. It names the characters rather than a kind of match,
    /// because "contains" is what the reader can check against their own line.
    static let alsoContains = "Also contains"

    /// Named as the directories they are read from, because that is what the reader can act on:
    /// a machine with a slow home folder is a thing they know about their own machine.
    static let readingSkills = "Reading the skills installed for this Project…"

    /// Says what is missing AND that nothing is: the skills below are all of them, so the reader
    /// is not being asked to wait before using the menu.
    static let readingBuiltins =
        "Reading Claude Code's own commands — your skills are already here."

    /// Names the failure and then the way round it, because typing a built-in blind has always
    /// worked and goes on working (decision 10).
    static let builtinsUnavailable = """
    Argo could not read this CLI's built-in commands, so only skills are listed. \
    Typing a built-in by name still works.
    """

    /// A statement about the FILE, for a skill whose frontmatter states no description (#685).
    static let undescribed = "no description in its frontmatter"

    /// The mark on a row standing where one of the user's own skills would be (#685).
    static let shadows = "shadows yours"

    /// Where the reader's characters sit in a command, counted over the WHOLE command so the
    /// leading `/` and a plugin's namespace are both reachable by typing.
    ///
    /// A substring and not a subsequence: the fuzzy rule is the file picker's (decision 13), where
    /// it earns its keep over nine-segment paths. Over short command names it would put rows nobody
    /// recognises above the one they meant.
    private static func match(_ query: String, in command: String) -> Range<Int>? {
        let name = Array(command.dropFirst().lowercased())
        let wanted = Array(query)
        guard !wanted.isEmpty, wanted.count <= name.count else { return nil }
        for start in 0 ... (name.count - wanted.count)
            where Array(name[start ..< start + wanted.count]) == wanted {
            return (start + 1) ..< (start + wanted.count + 1)
        }
        return nil
    }

    private static func row(for command: Command, matched: Range<Int>, origin: String?) -> Row {
        Row(
            id: command.command,
            // It inserts and never sends, so an argument can be typed before ⏎
            // (`slash-args.png`). The whole line goes, because the menu only opens on a line that
            // is a `/` and a run of non-space: the typed fragment IS the line.
            insert: "\(command.command) ",
            lead: command.command,
            matched: matched,
            detail: Detail(
                words: command.description.flatMap(firstSentence) ?? undescribed,
                voice: .sentence,
            ),
            badges: badges(for: command, origin: origin),
        )
    }

    /// The shadow mark first, because it is about the row rather than about where it came from.
    private static func badges(for command: Command, origin: String?) -> [Badge] {
        var badges: [Badge] = []
        if command.shadowsUser {
            badges.append(Badge(words: shadows, tone: .attention))
        }
        if let origin {
            badges.append(Badge(words: origin, tone: .quiet))
        }
        return badges
    }

    /// The first sentence of the source's own words — a skill's frontmatter, or the CLI's own
    /// panel line (decision 4). There is no one-line description in a `SKILL.md`: the field is
    /// trigger prose for a model and real ones run three sentences, so the row takes the head of
    /// it verbatim and never a paraphrase.
    ///
    /// A sentence ends at `.`, `?` or `!` with whitespace or nothing after it, which is what keeps
    /// `e.g.` and a version number inside the sentence they belong to.
    private static func firstSentence(of description: String) -> String? {
        let characters = Array(description)
        for (at, character) in characters.enumerated() where ".?!".contains(character) {
            let next = at + 1
            guard next == characters.count || characters[next].isWhitespace else { continue }
            return String(characters[...at])
        }
        return description.isEmpty ? nil : description
    }
}
