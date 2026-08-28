import Foundation

/// An entity diagram under construction: the entities named so far, and the attributes each of
/// them has gathered.
///
/// An entity is named by the first line that mentions it, a relationship included — mermaid draws
/// `CUSTOMER ||--o{ ORDER : places` as two boxes whether or not either was ever declared.
struct MermaidEntityBuild {
    private var entries: [Entry] = []
    private(set) var relations: [MermaidRelation] = []
    var direction: MermaidDirection = .down

    private struct Entry {
        let name: String
        var title: String
        var attributes: [String] = []
    }

    var isEmpty: Bool {
        entries.isEmpty
    }
}

extension MermaidEntityBuild {
    /// One entity, named. The alias only ever arrives with a declaration, so a bare mention keeps
    /// whatever that declaration said whichever of the two the source wrote first.
    mutating func name(_ name: String, titled title: String? = nil) {
        guard let at = entries.firstIndex(where: { $0.name == name }) else {
            return entries.append(Entry(name: name, title: title ?? name))
        }
        guard let title, title != name else { return }
        entries[at].title = title
    }

    mutating func attribute(_ name: String, _ text: String) {
        self.name(name)
        guard let at = entries.firstIndex(where: { $0.name == name }) else { return }
        entries[at].attributes.append(text)
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
                MermaidCompartmented.Box(
                    name: $0.name,
                    compartments: MermaidCompartments(head: [$0.title], bands: [$0.attributes]),
                )
            },
            relations: relations,
        )
    }
}
