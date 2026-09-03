import ArgoFixtures
import Foundation

// Writes the checked-in synthetic of the largest Session, from the real transcript that never is
// (ADR-0030). Run it through `sh apps/macOS/scripts/synthesise-fixture.sh`.

guard let into = CommandLine.arguments.dropFirst().first else {
    FileHandle.standardError.write(Data("""
    usage: argo-synthesise <fixture-directory>

      Writes \(SettledSessionFixture.name).jsonl and \(SettledSessionFixture.name).shape.json into
      the directory named, from \(SettledSessionFixture.real.path), which is gitignored.

    """.utf8))
    exit(2)
}

let synthesis = Synthesis(source: SettledSessionFixture.real, into: URL(filePath: into))

do {
    try await synthesis.run()
    print("argo-synthesise: wrote the synthetic of \(SettledSessionFixture.real.path) into \(into)")
} catch let Synthesis.Failure.drifted(differences) {
    FileHandle.standardError.write(Data("""
    argo-synthesise: the synthetic reads as a different document from its source, so it was not
    written. Each line is one counted fact, source against synthetic — carry the field it comes
    from through verbatim in SyntheticTranscript rather than loosening the comparison.

    \(differences.joined(separator: "\n"))

    """.utf8))
    exit(1)
} catch let Synthesis.Failure.unreadable(url) {
    FileHandle.standardError.write(Data("argo-synthesise: cannot read \(url.path)\n".utf8))
    exit(1)
}
