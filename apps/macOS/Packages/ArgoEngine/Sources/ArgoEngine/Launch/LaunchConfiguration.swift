import Foundation

/// The external sources this process was launched against.
public struct LaunchConfiguration: Equatable, Sendable {
    /// Where the process was started, which is where a launch with nothing registered and nothing
    /// named still has to point.
    public let launchDirectoryURL: URL

    /// `--project`, the launch/harness override. Absent unless it was passed, because the override
    /// has to be told apart from the default: it points the Hub for this launch and **does not
    /// register** — registration is a deliberate act, not a side effect of a screenshot script.
    public let projectOverrideURL: URL?

    public let transcriptURLs: [URL]

    /// The catalog state to render instead of the cockpit, when the render harness asked for one.
    /// Carried as a name rather than a `Specimen`: the engine has no view layer to name.
    public let specimenName: String?

    /// Where this launch points before the registry has a say.
    public var projectURL: URL {
        projectOverrideURL ?? launchDirectoryURL
    }

    public init(
        launchDirectoryURL: URL,
        projectOverrideURL: URL? = nil,
        transcriptURLs: [URL],
        specimenName: String? = nil,
    ) {
        self.launchDirectoryURL = launchDirectoryURL.standardizedFileURL
        self.projectOverrideURL = projectOverrideURL?.standardizedFileURL
        self.transcriptURLs = transcriptURLs.map(\.standardizedFileURL)
        self.specimenName = specimenName
    }

    /// A configuration pointed at one named Project — what a caller that has already decided
    /// builds, and what the Hub's own tests read.
    public init(projectURL: URL, transcriptURLs: [URL], specimenName: String? = nil) {
        self.init(
            launchDirectoryURL: projectURL,
            projectOverrideURL: projectURL,
            transcriptURLs: transcriptURLs,
            specimenName: specimenName,
        )
    }

    public init(arguments: [String], currentDirectoryURL: URL) {
        let launchDirectoryURL = URL(
            fileURLWithPath: currentDirectoryURL.path,
            isDirectory: true,
        )
        var projectOverrideURL: URL?
        var transcriptURLs: [URL] = []
        var specimenName: String?
        var index = 0
        while index < arguments.count {
            let flag = arguments[index]
            guard index + 1 < arguments.count else { break }
            let value = arguments[index + 1]
            switch flag {
            case "--project":
                projectOverrideURL = URL(fileURLWithPath: value, relativeTo: launchDirectoryURL)
                index += 2
            case "--transcript":
                transcriptURLs.append(URL(fileURLWithPath: value, relativeTo: launchDirectoryURL))
                index += 2
            case "--specimen":
                specimenName = value
                index += 2
            default:
                index += 1
            }
        }
        self.init(
            launchDirectoryURL: launchDirectoryURL,
            projectOverrideURL: projectOverrideURL,
            transcriptURLs: transcriptURLs,
            specimenName: specimenName,
        )
    }
}
