import Foundation

/// The models and effort choices advertised by one harness.
public struct SessionRunCatalog: Equatable, Sendable {
    public let models: [Model]

    public init(models: [Model]) {
        self.models = models
    }

    public static let claude = SessionRunCatalog(models: [
        Model(
            id: "opus",
            name: "Opus 5",
            efforts: ClaudeEffort.offered,
            defaultEffort: .medium,
            isDefault: true,
        ),
        Model(
            id: "sonnet",
            name: "Sonnet 5",
            efforts: ClaudeEffort.offered,
            defaultEffort: .medium,
        ),
        Model(
            id: "haiku",
            name: "Haiku 4.5",
            efforts: ClaudeEffort.offered,
            defaultEffort: .medium,
        ),
    ])

    public var defaultRun: SessionRun? {
        guard let model = models.first(where: \.isDefault) ?? models.first else { return nil }
        return SessionRun(model: model.id, effort: model.defaultEffort)
    }

    /// A remembered choice is usable only while the selected harness still offers it.
    public func resolve(_ remembered: SessionRun?) -> SessionRun? {
        guard let remembered,
              let model = models.first(where: { $0.id == remembered.model })
        else { return defaultRun }
        return SessionRun(
            model: model.id,
            effort: model.efforts.contains(remembered.effort) ? remembered.effort : model
                .defaultEffort,
        )
    }

    public struct Model: Equatable, Sendable, Identifiable {
        public let id: String
        public let name: String
        public let efforts: [SessionEffort]
        public let defaultEffort: SessionEffort
        public let isDefault: Bool

        public init(
            id: String,
            name: String,
            efforts: [SessionEffort],
            defaultEffort: SessionEffort,
            isDefault: Bool = false,
        ) {
            self.id = id
            self.name = name
            self.efforts = efforts
            self.defaultEffort = defaultEffort
            self.isDefault = isDefault
        }
    }
}
