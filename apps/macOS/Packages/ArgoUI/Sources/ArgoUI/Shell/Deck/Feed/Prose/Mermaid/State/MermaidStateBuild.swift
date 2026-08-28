import Foundation

/// A state machine under construction: what the lines read so far have named, and which composite
/// blocks are still open around them.
///
/// The one place a state is FIRST named wins its description, exactly as a flowchart's node does.
/// A bare mention states nothing, so it overwrites nothing.
struct MermaidStateBuild {
    private(set) var nodes: [MermaidState.Node] = []
    private(set) var transitions: [MermaidState.Transition] = []
    var direction: MermaidDirection = .down
    private var names: [String] = []
    private var titles: [String] = []
    private var members: [[String]] = []
    /// The blocks open at the cursor, innermost last.
    private var open: [Int] = []

    var isBalanced: Bool {
        open.isEmpty
    }

    var composites: [MermaidState.Composite] {
        zip(zip(names, titles), members).map {
            MermaidState.Composite(name: $0.0, title: $0.1, members: $1)
        }
    }

    /// Which composite the cursor is inside, as the scope a `[*]` belongs to. The empty string is
    /// the machine itself, which no state can be named.
    var scope: String {
        open.last.map { names[$0] } ?? ""
    }
}

extension MermaidStateBuild {
    /// Opens a composite block. Its members accumulate until the matching `}`.
    mutating func openComposite(_ name: String, titled title: String) {
        names.append(name)
        titles.append(title)
        members.append([])
        open.append(names.count - 1)
    }

    /// Closes the innermost open block, and says whether there was one.
    mutating func closeComposite() -> Bool {
        open.popLast() != nil
    }

    /// One node, named. Enclosed by whichever blocks are open, which is what makes a nested frame's
    /// members its parent's too.
    mutating func add(_ node: MermaidState.Node) {
        enclose(node.name)
        guard let at = nodes.firstIndex(where: { $0.name == node.name }) else {
            return nodes.append(node)
        }
        guard node.label != node.name || node.figure != .state else { return }
        nodes[at] = node
    }

    /// A state's description, given after it was named. It states something even where the state
    /// was first mentioned bare, which is the whole point of the `id : words` spelling.
    mutating func describe(_ name: String, as label: String) {
        add(MermaidState.Node(name: name, label: name))
        guard let at = nodes.firstIndex(where: { $0.name == name }) else { return }
        nodes[at] = MermaidState.Node(name: name, label: label, figure: nodes[at].figure)
    }

    mutating func add(_ transition: MermaidState.Transition) {
        transitions.append(transition)
    }

    /// The node one end of a transition names: a state, or the scope's own start or end mark.
    mutating func end(_ word: String, isSource: Bool) -> String {
        guard word == MermaidStateWord.terminal else {
            add(MermaidState.Node(name: word, label: word))
            return word
        }
        // A name no state can be written as, and one per scope — so a machine with two ways in
        // draws one dot, and a composite's own start is not the machine's.
        let name = "\(MermaidStateWord.terminal)\(isSource ? "<" : ">")\(scope)"
        add(MermaidState.Node(name: name, label: "", figure: isSource ? .start : .end))
        return name
    }

    private mutating func enclose(_ name: String) {
        for at in open where !members[at].contains(name) {
            members[at].append(name)
        }
    }
}

/// A `note` block still being read: which state it is about, and the lines gathered so far.
struct MermaidStateNote {
    let about: String
    var text = ""

    mutating func add(_ line: String) {
        text += text.isEmpty ? line : " \(line)"
    }
}

extension MermaidStateBuild {
    func has(_ name: String) -> Bool {
        nodes.contains { $0.name == name }
    }

    /// A note, and the tether that says which state it is about. A node like any other, so the
    /// layered pass places it and it can never be drawn over the machine (#863).
    mutating func attach(_ note: MermaidStateNote) {
        let name = "note#\(nodes.count)"
        add(MermaidState.Node(name: name, label: note.text, figure: .note))
        add(MermaidState.Transition(from: note.about, to: name, kind: .attachment))
    }

    /// The machine these lines wrote.
    ///
    /// A composite's own name is not a state. `A --> Working` is read before `state Working {` is
    /// opened, so the node that transition made is dropped here and the frame stands in its place.
    var machine: MermaidState {
        let framed = Set(composites.map(\.name))
        return MermaidState(
            direction: direction,
            nodes: nodes.filter { !framed.contains($0.name) },
            transitions: transitions,
            composites: composites.map {
                MermaidState.Composite(
                    name: $0.name,
                    title: $0.title,
                    members: $0.members.filter { !framed.contains($0) },
                )
            },
        )
    }
}
