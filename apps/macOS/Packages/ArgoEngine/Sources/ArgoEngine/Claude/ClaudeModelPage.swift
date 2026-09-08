import Foundation

/// The Claude Models API response, decoded at the provider boundary (#1692).
struct ClaudeModelPage: Decodable {
    let data: [Model]
    let hasMore: Bool
    let lastID: String?

    var models: [SessionRunCatalog.Model] {
        data.enumerated().compactMap { index, model in
            let efforts = ClaudeEffort.offered.filter { effort in
                model.capabilities?.effort?.supports(effort) == true
            }
            guard !efforts.isEmpty else { return nil }
            let name = model.displayName.hasPrefix("Claude ")
                ? String(model.displayName.dropFirst("Claude ".count))
                : model.displayName
            let defaultEffort = efforts.contains(.medium) ? SessionEffort.medium : efforts[0]
            return SessionRunCatalog.Model(
                id: model.id, name: name, detail: Self.detail(for: name), efforts: efforts,
                defaultEffort: defaultEffort, isDefault: index == 0,
            )
        }
    }

    private static func detail(for name: String) -> String {
        let lower = name.lowercased()
        if lower.contains("opus") {
            return "For complex tasks"
        }
        if lower.contains("sonnet") {
            return "Most efficient for everyday tasks"
        }
        if lower.contains("haiku") {
            return "Fastest for quick answers"
        }
        return "Anthropic model"
    }

    enum CodingKeys: String, CodingKey {
        case data
        case hasMore = "has_more"
        case lastID = "last_id"
    }

    struct Model: Decodable {
        let id: String
        let displayName: String
        let capabilities: Capabilities?

        enum CodingKeys: String, CodingKey {
            case id
            case displayName = "display_name"
            case capabilities
        }
    }

    struct Capabilities: Decodable {
        let effort: Effort?
    }

    struct Effort: Decodable {
        let low: Support?
        let medium: Support?
        let high: Support?
        let xhigh: Support?
        let max: Support?

        func supports(_ effort: SessionEffort) -> Bool {
            switch effort {
            case .low: low?.supported == true
            case .medium: medium?.supported == true
            case .high: high?.supported == true
            case .xhigh: xhigh?.supported == true
            case .max: max?.supported == true
            case .none, .minimal, .ultra: false
            }
        }
    }

    struct Support: Decodable {
        let supported: Bool
    }
}
