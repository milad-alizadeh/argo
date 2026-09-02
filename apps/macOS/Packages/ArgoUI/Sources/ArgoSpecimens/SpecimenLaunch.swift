import ArgoEngine
import ArgoUI
import Foundation

/// What a launch's specimen arguments come to, settled before any window is built.
///
/// The app target dispatches on this rather than deciding it: a decision there is one no test can
/// reach, because the e2e suite launches onto `--specimen` and never builds the scene (ADR-0022).
@MainActor
public struct SpecimenLaunch {
    /// The state to render, and `nil` for an ordinary launch into the cockpit — or for one that
    /// stops before it draws anything.
    public let entry: SpecimenEntry?
    /// What this launch answers and stops on, and `nil` where it goes on to build a window.
    public let ending: Ending?
    /// What the window is pointed at, held so the app target reads the process's own launch once
    /// rather than building the configuration itself and handing it back in (ADR-0022: a
    /// derivation in the app target is one no test can reach).
    public let configuration: LaunchConfiguration

    /// This process's own launch, assembled HERE rather than in the app target: reading the
    /// arguments is a derivation, and a derivation in the app target is one no test can reach
    /// (ADR-0022). What the target is left with is the dispatch.
    public static var ofThisProcess: SpecimenLaunch {
        SpecimenLaunch(
            arguments: CommandLine.arguments,
            currentDirectoryPath: FileManager.default.currentDirectoryPath,
        )
    }

    /// The process's own launch. The folder is a PATH rather than a URL because that is what
    /// `FileManager` answers with, and turning it into one is this side's job.
    public init(arguments: [String], currentDirectoryPath: String) {
        self.init(LaunchConfiguration(
            arguments: arguments,
            currentDirectoryURL: URL(fileURLWithPath: currentDirectoryPath, isDirectory: true),
        ))
    }

    public init(_ configuration: LaunchConfiguration) {
        self.configuration = configuration
        if configuration.listsSpecimens {
            self.ending = Ending(
                // One name per line on STDOUT, which is where `scripts/specimens.sh` reads the
                // list from.
                words: SpecimenRegistry.names.map { "\($0)\n" }.joined(),
                stream: .standardOutput,
                code: 0,
            )
        } else if let refusal = SpecimenRegistry.refusal(for: configuration.specimenName) {
            self.ending = Ending(words: refusal, stream: .standardError, code: 1)
        } else {
            self.ending = nil
        }
        // A launch that stops renders nothing: the name behind an ending is either absent or one
        // the registry refused, so there is no entry to carry either way.
        self.entry = ending == nil
            ? configuration.specimenName.flatMap(SpecimenRegistry.entry(named:))
            : nil
    }

    /// A launch that answers on a stream and stops, rather than drawing anything.
    public struct Ending: Equatable {
        let words: String
        let stream: FileHandle
        let code: Int32

        /// Say it, and answer with the code the caller ends the process on.
        public func stated() -> Int32 {
            stream.write(Data(words.utf8))
            return code
        }
    }
}
