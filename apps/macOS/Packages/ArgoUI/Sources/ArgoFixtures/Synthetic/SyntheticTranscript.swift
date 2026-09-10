import ArgoEngine
import Foundation

/// One real transcript's lines → lines of the same shape carrying none of its words.
///
/// What the geometry of a Session is made of survives: the record count, every record's type, the
/// content parts inside it, the tool each call names, the ids that join a call to its result, and
/// the LENGTH of every string a row is drawn from. The words themselves do not, and neither does
/// any id that named something real.
///
/// Stateful across lines: an id minted for a call is the id its result quotes several records
/// later, and first appearance is what decides it.
///
/// `JSONSerialization` rather than a `Codable` model, which is the one place this file departs
/// from `rules/swift.md`: the pass has to hand back every field it did not model, and a decoded
/// type carries only the fields it declares.
package struct SyntheticTranscript {
    private var identifiers = SyntheticIdentifiers()

    package init() {}

    package mutating func synthesised(lines: [String]) -> [String] {
        lines.map { synthesised(line: $0) }
    }

    /// One line. A line that is not a JSON object is handed back unchanged: it is not a record, and
    /// the reader's own reading of it — an unreadable line — is part of the shape.
    package mutating func synthesised(line: String) -> String {
        guard let data = line.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data),
              let record = raw as? [String: Any],
              // `sortedKeys` so one input has one output, whatever order the parse handed the keys
              // back in — the determinism the fixture is regenerated under.
              let out = try? JSONSerialization.data(
                  withJSONObject: fields(of: record),
                  options: [.sortedKeys, .withoutEscapingSlashes],
              )
        else { return line }
        // Cannot fail: the serialiser writes UTF-8. An empty record rather than the line it
        // came from, because handing the input back is how real prose would leave here — and
        // a record of no type is a difference the generator refuses to write.
        return String(bytes: out, encoding: .utf8) ?? "{}"
    }

    /// Fields in NAME order, which is what makes the pass a function of the file rather than of
    /// the run: an id is minted when it is first seen, and a dictionary hands its keys back in a
    /// different order in every process.
    private mutating func fields(of record: [String: Any]) -> [String: Any] {
        record.keys.sorted().reduce(into: [:]) { out, key in
            out[named(key)] = record[key].map { value($0, under: key) }
        }
    }

    /// A key is a schema name most of the time and PROSE some of the time: `answers` is keyed by
    /// the question that was asked, and a host keys other objects by a file path. So a key that is
    /// not spelled as an identifier is scrambled like anything else somebody wrote.
    ///
    /// Scrambled by the same pass as the text, which is what keeps the join: a question and the
    /// key naming it are one string, and one string has one synthetic.
    private mutating func named(_ key: String) -> String {
        Self.isSchemaName(key) ? key : identifiers.scrambled(key, keepingJoinsIn: Self.joinTags)
    }

    /// Whether a string is already what this pass makes of one — what says a fixture holds no
    /// words of anybody's rather than only that it was written by some version of this file.
    package static func isSynthetic(_ text: String) -> Bool {
        SyntheticIdentifiers.isScrambled(text, keepingJoinsIn: joinTags)
    }

    /// Whether a key is spelled as a schema name rather than written as a sentence.
    package static func isSchemaName(_ key: String) -> Bool {
        key.utf8.allSatisfy(isIdentifier)
    }

    private static func isIdentifier(_ byte: UInt8) -> Bool {
        (byte >= UInt8(ascii: "a") && byte <= UInt8(ascii: "z"))
            || (byte >= UInt8(ascii: "A") && byte <= UInt8(ascii: "Z"))
            || (byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9"))
            || byte == UInt8(ascii: "_") || byte == UInt8(ascii: "-")
    }

    private mutating func value(_ raw: Any, under key: String) -> Any {
        switch raw {
        case let prose as String: text(prose, under: key)
        case let record as [String: Any]: fields(of: record)
        // The key travels into a list because the list is what the key names: `content` is an
        // array of parts, and a part's own keys decide the rest.
        case let list as [Any]: list.map { value($0, under: key) }
        default: raw
        }
    }

    private mutating func text(_ raw: String, under key: String) -> String {
        if Self.verbatim.contains(key) {
            return raw
        }
        // The stand-in itself is under the ceiling, so it is named as well as the size: without
        // that, a second pass over a synthetic would scramble the picture the first one wrote.
        if Self.pixels.contains(key),
           raw.utf8.count >= Self.imageBytes || raw == TranscriptFixtures.onePixelPNG {
            return TranscriptFixtures.onePixelPNG
        }
        if Self.identifying.contains(key) {
            return identifiers.id(for: raw)
        }
        if Self.sentences.contains(raw.trimmingCharacters(in: .whitespacesAndNewlines)) {
            return raw
        }
        return identifiers.scrambled(raw, keepingJoinsIn: Self.joinTags)
    }

    /// The fields a picture's bytes arrive in, and the size above which a string in one of them is
    /// a picture rather than a word.
    ///
    /// Scrambled, base64 is base64 of nothing — lorem letters cannot decode to an image — so a
    /// picture is replaced by a real one-pixel PNG instead. The synthetic therefore does NOT stand
    /// for what a picture COSTS: 58 of the source's 63 MB were screenshots, and the fixture is
    /// 4.6 MB.
    package static let pixels: Set<String> = ["data", "base64"]
    package static let imageBytes = 1024

    /// The whole sentences a reading matches rather than reads — the CLI's own, taken from where
    /// the reader takes them. Scrambled, an interrupt reads as something the reader typed, which
    /// is a prompt row where the source has punctuation.
    package static let sentences: Set<String> = ClaudeInterrupt.marks

    /// The fields a reader BRANCHES on rather than reads as words. Scrambled, each one is a record
    /// of a different kind, a call of a different tool or a Turn with no clock on it — which is a
    /// synthetic of a different shape, and the whole point of this one is that it has the same one.
    package static let verbatim: Set<String> = [
        "type", "subtype", "role", "name", "model", "stop_reason", "status", "level",
        "permissionMode", "mode", "entrypoint", "userType", "version", "media_type",
        "timestamp", "gitBranch",
    ]

    /// The fields that carry an id. Each is mapped rather than scrambled, so every join a reading
    /// makes still lands and nothing names a real Session, account or organisation.
    package static let identifying: Set<String> = [
        "id", "uuid", "parentUuid", "leafUuid", "sessionId", "session_id", "tool_use_id",
        "toolUseId", "toolUseID", "messageId", "requestId", "promptId", "bridgeSessionId",
        "ownerAccountUuid", "ownerOrganizationUuid", "agentId", "sourceToolAssistantUUID",
    ]

    /// The markers a transcript quotes an id inside, which is how a background agent's report
    /// names the call that delegated the work. A subset of what the text pass keeps.
    package static let joinTags = SyntheticLorem.markers.filter { $0.hasSuffix("-id") }
}
