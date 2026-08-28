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

    /// The registry state to render instead of the cockpit, when the render harness asked for one.
    /// Carried as a name rather than a `SpecimenEntry`: the engine has no view layer to name.
    public let specimenName: String?

    /// `--list-specimens`: print every renderable name and exit, which is how `specimens.sh` learns
    /// the list. The app is the one that knows it, so nothing else parses Swift source to find out.
    public let listsSpecimens: Bool

    /// Where this launch points before the registry has a say.
    public var projectURL: URL {
        projectOverrideURL ?? launchDirectoryURL
    }

    public init(
        launchDirectoryURL: URL,
        projectOverrideURL: URL? = nil,
        transcriptURLs: [URL],
        specimenName: String? = nil,
        listsSpecimens: Bool = false,
    ) {
        self.launchDirectoryURL = launchDirectoryURL.standardizedFileURL
        self.projectOverrideURL = projectOverrideURL?.standardizedFileURL
        self.transcriptURLs = transcriptURLs.map(\.standardizedFileURL)
        self.specimenName = specimenName
        self.listsSpecimens = listsSpecimens
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

    /// The same launch with both folders resolved to the repository ROOT each sits in.
    ///
    /// A launch may name any folder inside a repository while the registry holds roots, so both are
    /// resolved before `LaunchProject` matches them — without it, a launch inside a registered repo
    /// draws that repo twice. Here rather than on the coordinator for ADR-0022's reason: it is a
    /// derivation over values, and one in the app target is one no test can reach.
    public func resolvingRoots(through store: ProjectRegistryStore) async -> LaunchConfiguration {
        var overrideRootURL: URL?
        if let projectOverrideURL {
            overrideRootURL = await store.projectRoot(of: projectOverrideURL)
        }
        return await LaunchConfiguration(
            launchDirectoryURL: store.projectRoot(of: launchDirectoryURL),
            projectOverrideURL: overrideRootURL,
            transcriptURLs: transcriptURLs,
            specimenName: specimenName,
            listsSpecimens: listsSpecimens,
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
        var listsSpecimens = false
        var index = 0
        while index < arguments.count {
            let flag = arguments[index]
            // Before the guard below, which reads a VALUE off the next argument: this flag takes
            // none, and the harness passes it last.
            if flag == "--list-specimens" {
                listsSpecimens = true
                index += 1
                continue
            }
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
            listsSpecimens: listsSpecimens,
        )
    }
}
