import Foundation

/// A `classDiagram` source, read whole or not at all.
///
/// The half that matters is the `nil`, exactly as it is for every reader before this one: a line
/// this reader has no rule for, an unclosed block, a header it does not know — all of them leave
/// the block the fence it is today (#859).
enum MermaidClass {
    static let headers = ["classdiagram", "classdiagram-v2"]

    /// The class diagram this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidCompartmented? {
        var lines = MermaidSource.lines(of: source)
        guard let header = lines.first, headers.contains(header.lowercased()) else { return nil }
        lines.removeFirst()
        var build = MermaidClassBuild()
        var open: String?
        for line in lines {
            guard step(line, into: &build, open: &open) else { return nil }
        }
        // A header on its own draws nothing, and a block still open is half a class.
        guard open == nil, !build.isEmpty else { return nil }
        return build.diagram
    }

    /// One line, read. `false` is a line this reader has no rule for, which refuses the source.
    private static func step(
        _ line: String,
        into build: inout MermaidClassBuild,
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
        if let rest = MermaidSource.word("class", of: line) {
            return declared(rest, into: &build, open: &open)
        }
        if let annotation = marked(line, into: &build) {
            return annotation
        }
        return related(line, into: &build) ?? described(line, into: &build)
    }

    /// One line inside a `class X { … }` block: `}` closes it, `<<keyword>>` annotates the class,
    /// and anything else is one of its members.
    private static func held(
        _ line: String,
        by name: String,
        into build: inout MermaidClassBuild,
        open: inout String?,
    )
        -> Bool {
        guard line != "}" else {
            open = nil
            return true
        }
        guard let annotation = MermaidClassWord.annotation(line) else {
            guard let member = MermaidClassWord.angled(line) else { return false }
            build.member(name, member)
            return true
        }
        build.annotate(name, with: annotation)
        return true
    }

    /// `class X`, `class X~T~`, and either of those opening a block.
    private static func declared(
        _ rest: String,
        into build: inout MermaidClassBuild,
        open: inout String?,
    )
        -> Bool {
        let isBlock = rest.hasSuffix("{")
        let body = isBlock
            ? String(rest.dropLast()).trimmingCharacters(in: .whitespaces)
            : rest
        guard let named = MermaidClassWord.named(body) else { return false }
        build.name(named.name, titled: named.title)
        if isBlock {
            open = named.name
        }
        return true
    }

    /// `<<interface>> Shape`, the spelling that annotates a class from outside its own block.
    private static func marked(_ line: String, into build: inout MermaidClassBuild) -> Bool? {
        let words = line.split(separator: " ", maxSplits: 1).map(String.init)
        guard words.count == 2, let annotation = MermaidClassWord.annotation(words[0]) else {
            return nil
        }
        guard MermaidClassWord.isName(words[1]) else { return false }
        build.annotate(words[1], with: annotation)
        return true
    }

    /// `Store : +List~Item~ held`, which adds one member to a class named anywhere in the source.
    private static func described(_ line: String, into build: inout MermaidClassBuild) -> Bool {
        guard let cut = MermaidSource.split(line),
              let named = MermaidClassWord.named(cut.head), !cut.tail.isEmpty,
              let member = MermaidClassWord.angled(cut.tail) else { return false }
        build.name(named.name, titled: named.title)
        build.member(named.name, member)
        return true
    }
}
