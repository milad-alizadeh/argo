import ArgoEngine
import Foundation

// Phase 1's face: the engine with no UI over it. Point it at a transcript and it prints what the
// records MEAN, as they land.
//
// Its job is to be inspectable — the parse is exercised against a real agent's own output rather
// than only against fixtures, and a shape the reader gets wrong is visible in one line of terminal
// instead of in a view three phases from now.

let arguments = CommandLine.arguments.dropFirst()

guard let path = arguments.first(where: { !$0.hasPrefix("--") }) else {
    FileHandle.standardError.write(Data("""
    usage: argo-observe <transcript.jsonl> [--once]

      Prints one line per event as the file grows.
      --once  read what is already there and exit, instead of following.

    """.utf8))
    exit(2)
}

let url = URL(fileURLWithPath: path)
guard FileManager.default.fileExists(atPath: url.path) else {
    FileHandle.standardError.write(Data("no such transcript: \(url.path)\n".utf8))
    exit(1)
}

// The disk reader, because this is the one caller that HAS a disk: an image the record embedded no
// bytes for is re-read from the path, at the lower tier, and labelled as such by `describe`.
let reader = TranscriptReader(readImage: diskImageReader)
let follow = !arguments.contains("--once")

if follow {
    for await line in transcriptLines(at: url) {
        for event in await reader.read(line: line) { print(describe(event)) }
    }
} else {
    let lines = (try? String(contentsOf: url, encoding: .utf8))?
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init) ?? []
    for event in await reader.read(lines: lines) { print(describe(event)) }
}
