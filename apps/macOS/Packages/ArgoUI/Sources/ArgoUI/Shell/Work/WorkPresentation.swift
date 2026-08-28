/// How one parent ticket is presented — as the node tree, or as the Route (#334, #335).
///
/// Map-scoped rather than room-scoped, which is why the reader's choice is held as a SET of ticket
/// numbers: mapping one parent says nothing about any other.
enum WorkPresentation: String, Sendable, CaseIterable, Identifiable {
    case tree
    case map

    var id: Self {
        self
    }

    var name: String {
        switch self {
        case .tree: "Tree"
        case .map: "Map"
        }
    }
}
