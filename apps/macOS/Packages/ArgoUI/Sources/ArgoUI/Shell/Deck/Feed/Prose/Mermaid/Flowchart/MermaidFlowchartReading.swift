import Foundation

// A flowchart's source, read whole or not at all.
//
// The half that matters is the `nil`. A source this reader does not fully understand — a directive
// it has no rule for, an unbalanced `subgraph`, a link it cannot draw — leaves the block the fence
// it is today, which is the domain model's degrade-down applied to a block kind (#859).

extension MermaidFlowchart {
    /// The flowchart this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidFlowchart? {
        var lines = source
            .components(separatedBy: "\n")
            .map { Self.stripped($0) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty, let direction = Self.direction(ofHeader: lines.removeFirst()) else {
            return nil
        }
        var build = MermaidFlowchartBuild()
        for line in lines {
            guard Self.add(line, to: &build) else { return nil }
        }
        // A header on its own is a diagram with nothing in it, and an unclosed block is half a one.
        guard build.isBalanced, !build.nodes.isEmpty else { return nil }
        return MermaidFlowchart(
            direction: direction,
            nodes: build.nodes,
            edges: build.edges,
            groups: build.groups,
        )
    }

    /// One line, added — a block opening, a block closing, or a statement. `false` is a line this
    /// reader has no rule for, which refuses the whole source.
    private static func add(_ line: String, to build: inout MermaidFlowchartBuild) -> Bool {
        if line.lowercased() == "end" {
            return build.closeGroup()
        }
        if let title = subgraphTitle(of: line) {
            build.openGroup(titled: title)
            return true
        }
        guard let statement = MermaidStatement.read(line) else { return false }
        build.add(statement)
        return true
    }

    /// A line with its comment and its optional trailing `;` taken off. `%%` is mermaid's own
    /// comment and says nothing about the diagram.
    private static func stripped(_ line: String) -> String {
        var line = line
        if let comment = line.range(of: "%%") {
            line = String(line[line.startIndex ..< comment.lowerBound])
        }
        line = line.trimmingCharacters(in: .whitespaces)
        return (line.hasSuffix(";") ? String(line.dropLast()) : line)
            .trimmingCharacters(in: .whitespaces)
    }

    /// Which way `graph TD` and `flowchart LR` run. A header with no direction runs top-down, which
    /// is mermaid's own default.
    private static func direction(ofHeader line: String) -> Direction? {
        let words = line.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        guard let first = words.first, ["graph", "flowchart"].contains(first.lowercased()) else {
            return nil
        }
        guard words.count > 1 else { return .down }
        guard words.count == 2 else { return nil }
        switch words[1].uppercased() {
        case "TD", "TB": return .down
        case "BT": return .up
        case "LR": return .right
        case "RL": return .left
        default: return nil
        }
    }

    /// The title a `subgraph` was opened with — `subgraph Reading`, or `subgraph read [Reading]`,
    /// where the id is mermaid's own handle and the bracket carries the words. Anything else after
    /// the keyword IS the title, spaces and all, which is what mermaid does with it.
    private static func subgraphTitle(of line: String) -> String? {
        guard line.lowercased().hasPrefix("subgraph") else { return nil }
        let rest = line.dropFirst("subgraph".count).trimmingCharacters(in: .whitespaces)
        var scan = MermaidScan(rest)
        _ = scan.takeRun(where: Node.isNameCharacter)
        scan.skipSpaces()
        guard Node.opensLabel(scan), let spelled = Node.readLabel(&scan),
              scan.rest.trimmingCharacters(in: .whitespaces).isEmpty
        else { return rest }
        return spelled.label
    }
}
