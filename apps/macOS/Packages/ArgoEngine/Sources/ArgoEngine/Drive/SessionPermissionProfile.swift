/// The permission control an adapter publishes for one Session or prepared Session.
///
/// Choice ids and words belong to the adapter. Callers compare and return ids without interpreting
/// them. The underlying rung and startup arguments stay engine-internal.
public struct SessionPermissionProfile: Equatable, Sendable {
    public let choices: [Choice]
    public var selectedID: String?
    public let defaultID: String

    public init(choices: [Choice], selectedID: String?, defaultID: String) {
        self.choices = choices
        self.selectedID = selectedID
        self.defaultID = defaultID
    }

    @discardableResult
    public mutating func select(_ id: String) -> Bool {
        guard choices.contains(where: { $0.id == id }) else { return false }
        selectedID = id
        return true
    }

    var selected: Choice? {
        choices.first { $0.id == selectedID }
    }

    public struct Choice: Equatable, Sendable, Identifiable {
        public let id: String
        public let name: String
        public let detail: String
        let mode: SessionMode
        let launchArguments: [String]

        public init(
            id: String,
            name: String,
            detail: String,
            mode: SessionMode,
        ) {
            self.init(id: id, name: name, detail: detail, mode: mode, launchArguments: [])
        }

        init(
            id: String,
            name: String,
            detail: String,
            mode: SessionMode,
            launchArguments: [String],
        ) {
            self.id = id
            self.name = name
            self.detail = detail
            self.mode = mode
            self.launchArguments = launchArguments
        }
    }
}
