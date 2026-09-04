@testable import ArgoEngine
import Foundation

// What both halves of #1202 are read with: the record shape a fork is made of, and the two
// readings taken of it. Shared so the reader's suite and the reading's suite cannot drift into
// asserting against two different spellings of the same bytes.

/// One `user` record, in the field set `claude` 2.1.226 writes for a typed prompt. The `parentUuid`
/// is the whole fixture: two of these under one parent ARE the fork.
func resubmittedPrompt(_ uuid: String, under parent: String?, saying text: String) -> String {
    let parentField = parent.map { "\"\($0)\"" } ?? "null"
    return """
    {"type": "user", "parentUuid": \(parentField), "message": {"role": "user", \
    "content": "\(text)"}, "uuid": "\(uuid)", "sessionId": "s"}
    """
}

/// Every prompt a reading drew, in order — what "one Turn draws one row" is asserted on.
func promptsDrawn(in events: [TranscriptEvent]) -> [String] {
    events.compactMap { event in
        guard case let .prompt(text, _, _) = event else { return nil }
        return text
    }
}

/// The reading a Session takes of those events, folded the way the Hub folds one.
func sessionReading(of events: [TranscriptEvent]) -> HubSession {
    var session = HubSession(observation: TranscriptObservation(
        id: "s",
        sourceURL: URL(fileURLWithPath: "/tmp/s.jsonl"),
        events: AsyncStream { $0.finish() },
    ))
    for event in events {
        session.apply(event)
    }
    return session
}

/// Whether a reading carries a supersede marker at all — the reader's own answer, before anything
/// spends it.
func carriesSupersede(_ events: [TranscriptEvent]) -> Bool {
    events.contains { event in
        guard case .superseded = event else { return false }
        return true
    }
}
