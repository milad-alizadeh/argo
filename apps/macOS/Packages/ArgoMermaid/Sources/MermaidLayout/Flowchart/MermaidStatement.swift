import Foundation

/// One line of a flowchart's body: node groups joined by links.
///
/// A statement is a CHAIN, not a pair. `A --> B --> C` names three groups and two links, and
/// `A & B --> C` names one group of two — so the line reads as a sequence of groups with a link
/// between each neighbouring two, and every combination of a link's two groups is an edge.
struct MermaidStatement: Equatable, Sendable {
    let groups: [[MermaidFlowchart.Node]]
    let links: [MermaidLink]
}

extension MermaidStatement {
    /// The statement this line writes, or `nil` for a line this reader cannot draw. Nothing is
    /// skipped: a line read half-way would draw a diagram nobody wrote.
    static func read(_ line: String) -> Self? {
        var scan = MermaidScan(line)
        var groups: [[MermaidFlowchart.Node]] = []
        var links: [MermaidLink] = []
        while true {
            guard let group = readGroup(&scan) else { return nil }
            groups.append(group)
            scan.skipSpaces()
            if scan.isDone {
                break
            }
            guard let link = MermaidLink.read(&scan) else { return nil }
            links.append(link)
            scan.skipSpaces()
        }
        // A trailing link with nothing after it is half a statement.
        guard groups.count == links.count + 1 else { return nil }
        return MermaidStatement(groups: groups, links: links)
    }

    /// The nodes on one side of a link — `A`, or `A & B & C`, which all take the same link.
    private static func readGroup(_ scan: inout MermaidScan) -> [MermaidFlowchart.Node]? {
        var group: [MermaidFlowchart.Node] = []
        while true {
            scan.skipSpaces()
            guard let node = MermaidFlowchart.Node.read(&scan) else { return nil }
            group.append(node)
            scan.skipSpaces()
            guard scan.take("&") else { return group }
        }
    }

    /// Every edge this statement states: each link joining every node of the group before it to
    /// every node of the group after, in the order the source wrote them.
    var edges: [MermaidFlowchart.Edge] {
        links.enumerated().flatMap { at, link in
            groups[at].flatMap { from in
                groups[at + 1].map { to in
                    MermaidFlowchart.Edge(
                        from: from.name,
                        to: to.name,
                        label: link.label,
                        stroke: link.stroke,
                        hasHead: link.hasHead,
                    )
                }
            }
        }
    }
}
