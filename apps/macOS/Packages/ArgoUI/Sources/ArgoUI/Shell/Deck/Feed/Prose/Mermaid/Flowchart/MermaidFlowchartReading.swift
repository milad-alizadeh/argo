import Foundation

// A flowchart's source, read whole or not at all.
//
// The half that matters is the `nil`. A source this reader does not fully understand — a directive
// it has no rule for, an unbalanced `subgraph`, a link it cannot draw — leaves the block the fence
// it is today, which is the domain model's degrade-down applied to a block kind (#859).

extension MermaidFlowchart {
    /// The flowchart this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidFlowchart? {
        var lines = MermaidSource.lines(of: source)
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

    /// Which way `graph TD` and `flowchart LR` run. A header with no direction runs top-down, which
    /// is mermaid's own default.
    private static func direction(ofHeader line: String) -> MermaidDirection? {
        let words = line.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        guard let first = words.first, ["graph", "flowchart"].contains(first.lowercased()) else {
            return nil
        }
        guard words.count > 1 else { return .down }
        guard words.count == 2 else { return nil }
        return MermaidDirection.named(words[1])
    }

    /// The title a `subgraph` was opened with — `subgraph Reading`, or `subgraph read [Reading]`,
    /// where the id is mermaid's own handle and the bracket carries the words. Anything else after
    /// the keyword IS the title, spaces and all, which is what mermaid does with it.
    private static func subgraphTitle(of line: String) -> String? {
        let keyword = "subgraph"
        guard line.lowercased().hasPrefix(keyword) else { return nil }
        // The keyword and not merely its letters: `subgraphFoo --> B` names a node, and reading it
        // as a block would open one nothing ever closes and refuse the whole diagram.
        let rest = line.dropFirst(keyword.count)
        guard rest.first.map({ !MermaidScan.isIdentifier($0) }) ?? true else {
            return nil
        }
        let title = rest.trimmingCharacters(in: .whitespaces)
        var scan = MermaidScan(title)
        _ = scan.takeIdentifier()
        scan.skipSpaces()
        guard Node.opensLabel(scan), let spelled = Node.readLabel(&scan),
              scan.rest.trimmingCharacters(in: .whitespaces).isEmpty
        else { return title }
        return spelled.label
    }
}
