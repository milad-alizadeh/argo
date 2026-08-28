import Foundation

/// An `erDiagram` source, read whole or not at all.
///
/// The same compartmented boxes a class diagram is drawn as, with crow's foot at the ends instead
/// of UML's markers — which is the whole reason the two are one ticket (#865).
enum MermaidEntity {
    /// The entity diagram this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidCompartmented? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, header.lowercased() == "erdiagram" else { return nil }
        lines.removeFirst()
        var build = MermaidEntityBuild()
        var open: String?
        for line in lines {
            guard step(line, into: &build, open: &open) else { return nil }
        }
        // A header on its own draws nothing, and a block still open is half an entity.
        guard open == nil, !build.isEmpty else { return nil }
        return build.diagram
    }

    /// One line, read. `false` is a line this reader has no rule for, which refuses the source.
    private static func step(
        _ line: String,
        into build: inout MermaidEntityBuild,
        open: inout String?,
    )
        -> Bool {
        if let inside = open {
            return held(line, by: inside, into: &build, open: &open)
        }
        if let rest = MermaidSource.word("direction", of: line) {
            guard let direction = MermaidDirection.named(rest) else { return false }
            build.direction = direction
            return true
        }
        if let opened = MermaidEntityWord.block(line) {
            build.name(opened.name, titled: opened.title)
            open = opened.name
            return true
        }
        return related(line, into: &build)
    }

    /// One line inside an entity's block: `}` closes it, anything else is an attribute — a type and
    /// a name, and whatever key markers and comment the source wrote after them.
    private static func held(
        _ line: String,
        by name: String,
        into build: inout MermaidEntityBuild,
        open: inout String?,
    )
        -> Bool {
        guard line != "}" else {
            open = nil
            return true
        }
        guard let attribute = MermaidEntityWord.attribute(line) else { return false }
        build.attribute(name, attribute)
        return true
    }

    /// `CUSTOMER ||--o{ ORDER : places`, with its word where it carries one.
    private static func related(_ line: String, into build: inout MermaidEntityBuild) -> Bool {
        let cut = MermaidSource.split(line)
        guard let join = MermaidJoin.read(cut?.head ?? line, terminal: MermaidEntityWord.terminal),
              let from = MermaidEntityWord.named(join.before),
              let to = MermaidEntityWord.named(join.after),
              cut?.tail.isEmpty != true else { return false }
        build.relate(MermaidRelation(
            from: from.name,
            to: to.name,
            tail: join.tail,
            head: join.head,
            line: join.line,
            label: cut.map { MermaidSource.unquoted($0.tail) },
        ))
        build.name(from.name, titled: from.title)
        build.name(to.name, titled: to.title)
        return true
    }
}
