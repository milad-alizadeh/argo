import Foundation

// A mindmap's source, read whole or not at all.
//
// Every other reader here matches a line against a pattern. This one cannot: the structure is the
// INDENT, so what a line means depends on the column of the line above it. The build below holds
// the branch open at the cursor and folds it shut the moment a line comes back out.

extension MermaidMindmap {
    /// The mindmap this source draws, or `nil` for anything this reader cannot — a header it does
    /// not know, a second root, a bracket that never closes, a fence with nothing in it yet.
    static func read(_ source: String) -> MermaidMindmap? {
        guard var lines = MermaidSource.indented(of: source),
              let header = lines.first, header.text.lowercased() == "mindmap"
        else { return nil }
        lines.removeFirst()
        var build = MermaidMindmapBuild()
        for line in lines {
            guard build.add(line) else { return nil }
        }
        return build.mindmap
    }
}

/// A mindmap under construction: the branch open at the cursor, and the column each of its nodes
/// stands at.
///
/// The columns are kept as they were WRITTEN rather than divided by a width. A source indented two,
/// then three, then five is nested three deep — any consistent widening is a nesting, which is the
/// only rule that copes with the indents people really write (#867).
private struct MermaidMindmapBuild {
    /// The ancestors of the cursor, root first — each still gathering the children under it.
    private var path: [MermaidMindmap.Node] = []
    private var columns: [Int] = []

    /// The map, every branch folded shut. `nil` for a header nothing was written under.
    var mindmap: MermaidMindmap? {
        var path = path
        while path.count > 1 {
            Self.fold(&path)
        }
        return path.first.map { MermaidMindmap(root: $0) }
    }

    /// One line, added. `false` refuses the whole source.
    mutating func add(_ line: MermaidSource.Line) -> Bool {
        if annotate(line.text) {
            return true
        }
        guard let node = MermaidMindmap.Node.read(line.text) else { return false }
        while columns.count > 1, line.column <= columns[columns.count - 1] {
            columns.removeLast()
            Self.fold(&path)
        }
        // Back at the root's own column with a root already standing is a second root, which
        // mermaid refuses too — a mindmap has exactly one centre.
        guard columns.first.map({ line.column > $0 }) ?? true else { return false }
        columns.append(line.column)
        path.append(node)
        return true
    }

    /// `::icon(…)` and `:::someClass`, which say something about the node above rather than adding
    /// one under it. Read as nodes they would nest a phantom child under every annotated branch.
    ///
    /// A class is kept as the FACT of one and an icon is dropped outright, and the asymmetry is the
    /// point. `:::urgent` says this node is called out, which the diagram can draw; `::icon(fa
    /// fa-book)` names a glyph in an icon font Argo does not ship, and there is nothing honest to
    /// put in its place. Both are consumed either way, so neither becomes a phantom child.
    private mutating func annotate(_ text: String) -> Bool {
        guard text.hasPrefix(":::") || text.hasPrefix("::icon(") else { return false }
        // The class NAME is dropped too: Argo has no user stylesheet to resolve it against.
        if text.hasPrefix(":::"), !path.isEmpty {
            path[path.count - 1].isCalledOut = true
        }
        return true
    }

    /// The deepest node shut, and hung under the one above it.
    private static func fold(_ path: inout [MermaidMindmap.Node]) {
        let child = path.removeLast()
        path[path.count - 1].children.append(child)
    }
}
