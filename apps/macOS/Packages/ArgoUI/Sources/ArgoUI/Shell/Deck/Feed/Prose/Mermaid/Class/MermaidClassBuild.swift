import Foundation

/// A class diagram under construction: the classes named so far and what each of them holds.
///
/// A class is named by the first line that mentions it, a relationship included — mermaid draws
/// `Animal <|-- Duck` as two boxes whether or not either was ever declared, so a reader that only
/// counted declarations would arrow at a class that is not there.
struct MermaidClassBuild {
    private var entries: [Entry] = []
    private(set) var relations: [MermaidRelation] = []
    var direction: MermaidDirection = .down

    /// One class as it is being gathered: what relationships name it, what its box says, and the
    /// two bands of members under that.
    private struct Entry {
        let name: String
        var title: String
        var annotation: String?
        var attributes: [String] = []
        var methods: [String] = []
    }

    var isEmpty: Bool {
        entries.isEmpty
    }
}

extension MermaidClassBuild {
    /// One class, named. The title only ever arrives with a declaration, so a bare mention keeps
    /// whatever the declaration said whichever of the two the source wrote first.
    mutating func name(_ name: String, titled title: String? = nil) {
        guard let at = entries.firstIndex(where: { $0.name == name }) else {
            return entries.append(Entry(name: name, title: title ?? name))
        }
        // A bare mention passes the name as its own title, which must not undo a declaration that
        // already gave the class a real one.
        guard let title, title != name else { return }
        entries[at].title = title
    }

    /// A `<<keyword>>`, which stands above the name it qualifies.
    mutating func annotate(_ name: String, with annotation: String) {
        self.name(name)
        edit(name) { $0.annotation = annotation }
    }

    /// One member, already drawn as it will be set. A method is told from an attribute by its own
    /// parentheses, which is the same rule mermaid sorts the two compartments by.
    mutating func member(_ name: String, _ text: String) {
        self.name(name)
        edit(name) {
            if text.contains("(") {
                $0.methods.append(text)
            } else {
                $0.attributes.append(text)
            }
        }
    }

    /// The named entry, changed in place. It is always there: every caller names it first.
    private mutating func edit(_ name: String, _ change: (inout Entry) -> Void) {
        guard let at = entries.firstIndex(where: { $0.name == name }) else { return }
        change(&entries[at])
    }

    mutating func relate(_ relation: MermaidRelation) {
        name(relation.from)
        name(relation.to)
        relations.append(relation)
    }

    /// The diagram these lines wrote, as the compartmented boxes both diagram types are drawn as.
    var diagram: MermaidCompartmented {
        MermaidCompartmented(
            direction: direction,
            boxes: entries.map {
                MermaidCompartmented.Box(name: $0.name, compartments: MermaidCompartments(
                    // Mermaid sets an annotation in guillemets, above the name it qualifies.
                    head: ($0.annotation.map { ["«\($0)»"] } ?? []) + [$0.title],
                    bands: [$0.attributes, $0.methods],
                ))
            },
            relations: relations,
        )
    }
}
