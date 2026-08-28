import ArgoEngine
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

    public init(_ configuration: LaunchConfiguration) {
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
