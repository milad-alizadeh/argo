import Foundation

/// A flowchart under construction: what the lines read so far have named, and which `subgraph`
/// blocks are still open around them.
///
/// The one place a node is FIRST named wins its label and its figure. `A[Start] --> B` then
/// `A --> C` names `A` twice and only the first spelling said anything, so a later bare mention
/// must not quietly reset the box to its own name.
struct MermaidFlowchartBuild {
    private(set) var nodes: [MermaidFlowchart.Node] = []
    private(set) var edges: [MermaidFlowchart.Edge] = []
    private var titles: [String] = []
    private var members: [[String]] = []
    /// The blocks open at the cursor, innermost last.
    private var open: [Int] = []

    var isBalanced: Bool {
        open.isEmpty
    }

    /// The blocks, in the order they were opened. A nested block's members are its parent's too, so
    /// the outer enclosure really does contain the inner one.
    var groups: [MermaidFlowchart.Group] {
        zip(titles, members).map { MermaidFlowchart.Group(title: $0, members: $1) }
    }
}

extension MermaidFlowchartBuild {
    /// One statement, added. Every node it named is enclosed by whichever blocks are open.
    mutating func add(_ statement: MermaidStatement) {
        for node in statement.groups.flatMap(\.self) {
            add(node)
        }
        edges += statement.edges
    }

    /// Opens a `subgraph`. Its members accumulate until the matching `end`.
    mutating func openGroup(titled title: String) {
        titles.append(title)
        members.append([])
        open.append(titles.count - 1)
    }

    /// Closes the innermost open `subgraph`, and says whether there was one.
    mutating func closeGroup() -> Bool {
        open.popLast() != nil
    }

    private mutating func add(_ node: MermaidFlowchart.Node) {
        enclose(node.name)
        guard let at = nodes.firstIndex(where: { $0.name == node.name }) else {
            return nodes.append(node)
        }
        // A bare mention states nothing, so it overwrites nothing.
        guard node.label != node.name || node.shape != .rect else { return }
        nodes[at] = node
    }

    private mutating func enclose(_ name: String) {
        for at in open where !members[at].contains(name) {
            members[at].append(name)
        }
    }
}
