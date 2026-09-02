import Foundation

/// The depth-first walk itself, kept as a value so its three pieces of state travel together rather
/// than as three inout parameters.
struct MermaidCycleWalk {
    let graph: MermaidGraph
    var reversed: Set<Int> = []
    private var done: Set<String> = []
    private var onStack: Set<String> = []

    init(graph: MermaidGraph) {
        self.graph = graph
    }

    mutating func visit(_ name: String) {
        guard !done.contains(name) else { return }
        done.insert(name)
        onStack.insert(name)
        for (at, edge) in graph.edges.enumerated() where edge.from == name {
            if onStack.contains(edge.to) {
                reversed.insert(at)
            } else {
                visit(edge.to)
            }
        }
        onStack.remove(name)
    }
}
