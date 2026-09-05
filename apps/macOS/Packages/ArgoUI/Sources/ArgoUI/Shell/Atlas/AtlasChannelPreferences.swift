import AtlasLayout
import Foundation

/// Where a reader's Atlas choices outlive the window they were made in: which Measure drives each
/// channel, and whether test files are hidden (#1161).
///
/// `UserDefaults` rather than a file beside the Map (`AtlasMapStore`'s own precedent): this is a
/// reader's preference and not a measurement, so it must survive a Map that gets regenerated —
/// and it is a few bytes, which is what the platform's own preference store is for.
///
/// Per Project, keyed on the Project's id the way the Map file already is: a choice about which
/// Measure sizes a footprint is a question about one repository's own Measures, and means nothing
/// carried to another.
struct AtlasChannelPreferences {
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// The channels the reader last chose for this Project, or `nil` where none has been chosen —
    /// which is the caller's instruction to fall back on `AtlasChannels.opening(for:)`.
    func channels(for projectID: String) -> AtlasChannels? {
        guard let data = defaults.data(forKey: channelsKey(projectID)) else { return nil }
        return try? JSONDecoder().decode(AtlasChannels.self, from: data)
    }

    func setChannels(_ channels: AtlasChannels, for projectID: String) {
        guard let data = try? JSONEncoder().encode(channels) else { return }
        defaults.set(data, forKey: channelsKey(projectID))
    }

    /// Off until the reader turns it on — a repository nobody has read yet must draw everything
    /// it has, tests included.
    func hideTests(for projectID: String) -> Bool {
        defaults.bool(forKey: hideTestsKey(projectID))
    }

    func setHideTests(_ hideTests: Bool, for projectID: String) {
        defaults.set(hideTests, forKey: hideTestsKey(projectID))
    }

    private func channelsKey(_ projectID: String) -> String {
        "argo.atlas.channels.\(projectID)"
    }

    private func hideTestsKey(_ projectID: String) -> String {
        "argo.atlas.hideTests.\(projectID)"
    }
}
