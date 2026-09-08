import Foundation

/// The installed app-server's model/list response, decoded at the protocol boundary (#1692).
struct CodexModelPage: Decodable {
    let data: [Model]
    let nextCursor: String?

    var models: [SessionRunCatalog.Model] {
        data.compactMap { model in
            guard !model.hidden, ModelID.named(in: model.model) != nil,
                  let defaultEffort = SessionEffort(rawValue: model.defaultReasoningEffort)
            else { return nil }
            let efforts = model.supportedReasoningEfforts.compactMap {
                SessionEffort(rawValue: $0.reasoningEffort)
            }
            guard efforts.contains(defaultEffort) else { return nil }
            return SessionRunCatalog.Model(
                id: model.model, name: model.displayName, efforts: efforts,
                defaultEffort: defaultEffort, isDefault: model.isDefault,
            )
        }
    }

    struct Model: Decodable {
        let model: String
        let displayName: String
        let hidden: Bool
        let isDefault: Bool
        let defaultReasoningEffort: String
        let supportedReasoningEfforts: [Effort]
    }

    struct Effort: Decodable {
        let reasoningEffort: String
    }
}
