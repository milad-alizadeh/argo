import ArgoEngine

/// Where the menu opens, what is in it, and in what order (design decisions 2, 3 and 4).
extension CommandMenuProjection {
    /// The menu for a line, or `nil` where the line opens none.
    static func menu(for text: String, in catalog: [Skill]) -> Menu? {
        guard let query = query(in: text) else { return nil }
        return Menu(sections: sections(of: catalog, matching: query), query: query)
    }

    /// What the reader has typed after the `/`, and `nil` where there is no `/` to be after.
    ///
    /// **Head of the line only**, and closed by the first space (decision 2). A slash inside
    /// `src/foo` is a path, and the space is what says the command is settled and its arguments
    /// have begun — which is the whole of what makes `slash-args.png` a sendable line rather than a
    /// menu standing over one.
    static func query(in text: String) -> String? {
        guard text.hasPrefix("/"), !text.contains(where: \.isWhitespace) else { return nil }
        return String(text.dropFirst())
    }

    private static func sections(of catalog: [Skill], matching query: String) -> [Section] {
        guard !query.isEmpty else { return byOrigin(catalog) }
        return byMatch(catalog, on: query.lowercased())
    }

    /// Nothing typed yet: one section per origin, nearest first, each saying where it read from and
    /// how many it found. The catalog already answers in that order, so the runs are consecutive.
    private static func byOrigin(_ catalog: [Skill]) -> [Section] {
        runs(of: catalog).map { origin, skills in
            Section(
                label: word(for: origin),
                detail: "\(origin.readFrom) · \(skills.count)",
                rows: skills.map { row(for: $0, matched: 0 ..< 0, origin: nil) },
            )
        }
    }

    private static func runs(of catalog: [Skill]) -> [(SkillOrigin, [Skill])] {
        catalog.reduce(into: []) { runs, skill in
            guard runs.last?.0 == skill.origin else { return runs.append((skill.origin, [skill])) }
            runs[runs.count - 1].1.append(skill)
        }
    }

    /// Filtering narrows AND reorders (decision 3): every prefix match first, in origin order, then
    /// the ones that merely contain the characters under their own header. A good match therefore
    /// never slides down the list as the reader types. Origin moves onto the rows, because the
    /// sections no longer group by it.
    private static func byMatch(_ catalog: [Skill], on query: String) -> [Section] {
        var opening: [Row] = []
        var containing: [Row] = []
        for skill in catalog {
            guard let matched = match(query, in: skill.command) else { continue }
            let row = row(for: skill, matched: matched, origin: word(for: skill.origin))
            if matched.lowerBound == 1 {
                opening.append(row)
            } else {
                containing.append(row)
            }
        }
        return [
            Section(label: nil, detail: nil, rows: opening),
            Section(
                label: alsoContains,
                detail: "\"\(query)\" · \(containing.count)",
                rows: containing,
            ),
        ].filter { !$0.rows.isEmpty }
    }

    /// The header over the weaker half. It names the characters rather than a kind of match,
    /// because "contains" is what the reader can check against their own line.
    static let alsoContains = "Also contains"

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

    private static func row(for skill: Skill, matched: Range<Int>, origin: String?) -> Row {
        Row(
            command: skill.command,
            matched: matched,
            description: skill.description.flatMap(firstSentence),
            origin: origin,
            shadowsUser: skill.shadowsUser,
        )
    }

    /// The first sentence of the frontmatter's own words (decision 4). There is no one-line
    /// description in a `SKILL.md` — the field is trigger prose for a model and real ones run three
    /// sentences — so the row takes the head of it verbatim and never a paraphrase.
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
