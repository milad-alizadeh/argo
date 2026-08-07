import Foundation

/// The external sources this process was launched against.
public struct LaunchConfiguration: Equatable, Sendable {
    public let projectURL: URL
    public let transcriptURLs: [URL]

    /// The catalog state to render instead of the cockpit, when the render harness asked for one.
    /// Carried as a name rather than a `Specimen`: the engine has no view layer to name.
    public let specimenName: String?

    public init(projectURL: URL, transcriptURLs: [URL], specimenName: String? = nil) {
        self.projectURL = projectURL.standardizedFileURL
        self.transcriptURLs = transcriptURLs.map(\.standardizedFileURL)
        self.specimenName = specimenName
    }

    public init(arguments: [String], currentDirectoryURL: URL) {
        let launchDirectoryURL = URL(
            fileURLWithPath: currentDirectoryURL.path,
            isDirectory: true,
        )
        var projectURL = launchDirectoryURL
        var transcriptURLs: [URL] = []
        var specimenName: String?
        var index = 0
        while index < arguments.count {
            let flag = arguments[index]
            guard index + 1 < arguments.count else { break }
            let value = arguments[index + 1]
            switch flag {
            case "--project":
                projectURL = URL(fileURLWithPath: value, relativeTo: launchDirectoryURL)
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
            projectURL: projectURL,
            transcriptURLs: transcriptURLs,
            specimenName: specimenName,
        )
    }
}
