@testable import ArgoUI
import AtlasLayout
import Foundation
import Testing

/// Where the reader's channel and filter choices outlive the window they were made in (#1161).
@Suite("Atlas — channel preferences")
struct AtlasChannelPreferencesTests {
    private static func defaults() throws -> UserDefaults {
        try #require(
            UserDefaults(suiteName: "argo.atlas-channel-preferences.\(UUID().uuidString)"),
            "The suite could not make defaults of its own.",
        )
    }

    @Test func `a project with no stored choice reports none`() throws {
        let preferences = try AtlasChannelPreferences(defaults: Self.defaults())

        #expect(preferences.channels(for: "project-1") == nil)
        #expect(preferences.hideTests(for: "project-1") == false)
    }

    @Test func `a stored choice is read back whole`() throws {
        let preferences = try AtlasChannelPreferences(defaults: Self.defaults())
        let channels = AtlasChannels(footprint: "lines", band: "commits", height: "authors")

        preferences.setChannels(channels, for: "project-1")

        #expect(preferences.channels(for: "project-1") == channels)
    }

    @Test func `hiding tests is remembered until turned off again`() throws {
        let preferences = try AtlasChannelPreferences(defaults: Self.defaults())

        preferences.setHideTests(true, for: "project-1")
        #expect(preferences.hideTests(for: "project-1") == true)

        preferences.setHideTests(false, for: "project-1")
        #expect(preferences.hideTests(for: "project-1") == false)
    }

    /// A choice is a question about ONE repository's own Measures, so it must not leak to another
    /// Project that happens to share a footprint name.
    @Test func `two Projects keep separate choices`() throws {
        let defaults = try Self.defaults()
        let preferences = AtlasChannelPreferences(defaults: defaults)

        preferences.setChannels(AtlasChannels("lines"), for: "project-1")
        preferences.setHideTests(true, for: "project-1")

        #expect(preferences.channels(for: "project-2") == nil)
        #expect(preferences.hideTests(for: "project-2") == false)
    }
}
