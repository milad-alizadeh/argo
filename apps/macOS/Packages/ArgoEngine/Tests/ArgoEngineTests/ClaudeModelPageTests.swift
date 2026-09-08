@testable import ArgoEngine
import Foundation
import Testing

@Suite("Claude model choices")
struct ClaudeModelPageTests {
    @Test func `the API catalog keeps the models and effort levels it advertises`() throws {
        let page = try JSONDecoder().decode(ClaudeModelPage.self, from: Data(Self.response.utf8))

        #expect(page.models.map(\.id) == ["claude-fable-5", "claude-opus-5"])
        #expect(page.models.map(\.name) == ["Fable 5", "Opus 5"])
        #expect(page.models[0].efforts == [.low, .medium, .high])
        #expect(page.models[1].efforts == [.medium, .max])
        #expect(page.models[0].isDefault)
    }

    private static let response = """
    {"data":[
      {"id":"claude-fable-5","display_name":"Claude Fable 5","capabilities":{"effort":{
        "low":{"supported":true},"medium":{"supported":true},"high":{"supported":true},
        "xhigh":{"supported":false},"supported":true}}},
      {"id":"claude-opus-5","display_name":"Claude Opus 5","capabilities":{"effort":{
        "medium":{"supported":true},"max":{"supported":true}}}}
    ],"has_more":false,"last_id":"claude-opus-5"}
    """
}
