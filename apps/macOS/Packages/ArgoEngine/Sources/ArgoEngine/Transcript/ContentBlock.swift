import Foundation

// One part of a message's content. The host stores prose, calls, results and images in ONE array,
// so this is where the four are told apart — and where a part that is none of them stops, rather
// than being guessed at.

/// A call the agent emitted, as the record carried it.
public struct ToolUseBlock: Sendable, Equatable {
    public let id: String
    public let name: String
    /// The tool's arguments, unread: their shape is the tool's own, and only the reading that wants
    /// a particular field knows which one to ask for.
    public let input: JSONValue
}

/// A call's answer, as the record carried it.
public struct ToolResultBlock: Sendable, Equatable {
    public let toolUseId: String
    /// Either a bare string or an array of content parts, kept as it was written.
    public let content: JSONValue
    public let isError: Bool
}

/// An image the agent was sent, embedded in the record.
public struct ImageBlock: Sendable, Equatable {
    public let mediaType: String
    public let base64: String?
}

public enum ContentBlock: Sendable, Equatable {
    case text(String)
    case thinking(String)
    case toolUse(ToolUseBlock)
    case toolResult(ToolResultBlock)
    case image(ImageBlock)
    /// A part whose `type` this reader does not know, or one whose own fields did not survive
    /// reading — `{"type": "text", "text": 12}` is a text part with no text in it.
    case unreadable
}

extension ContentBlock {
    /// A message's `content` field → its parts.
    ///
    /// A bare string is one text part: the host writes `"content": "Run the suite"` for a simple
    /// prompt and an array only when there is more than prose to carry.
    static func blocks(from content: JSONValue?) -> [ContentBlock] {
        guard let content else { return [] }
        if let text = content.string {
            return [.text(text)]
        }
        return content.array.map(ContentBlock.init(part:))
    }

    init(part: JSONValue) {
        switch part.stringField("type") {
        case "text":
            self = part.stringField("text").map(ContentBlock.text) ?? .unreadable
        case "thinking":
            self = part.stringField("thinking").map(ContentBlock.thinking) ?? .unreadable
        case "tool_use":
            self = Self.toolUse(from: part)
        case "tool_result":
            self = Self.toolResult(from: part)
        case "image":
            self = Self.image(from: part)
        default:
            self = .unreadable
        }
    }

    /// A call with no id or no name is unreadable rather than half-built: an id is what its result
    /// will arrive quoting, and without one the call can never be resolved.
    private static func toolUse(from part: JSONValue) -> ContentBlock {
        guard let id = part.stringField("id"), let name = part.stringField("name") else {
            return .unreadable
        }
        return .toolUse(
            ToolUseBlock(id: id, name: name, input: part["input"] ?? .null),
        )
    }

    private static func toolResult(from part: JSONValue) -> ContentBlock {
        guard let id = part.stringField("tool_use_id") else { return .unreadable }
        return .toolResult(
            ToolResultBlock(
                toolUseId: id,
                content: part["content"] ?? .null,
                // Only an explicit `true` is a failure. A missing flag is a call that did not say
                // it failed, which is not the same as one that said it succeeded.
                isError: part["is_error"]?.bool == true,
            ),
        )
    }

    /// `{"type": "image", "source": {"data": …, "media_type": "image/png"}}` — the shape the agent
    /// was actually sent.
    private static func image(from part: JSONValue) -> ContentBlock {
        guard let source = part["source"],
              let mediaType = imageMediaType(source.stringField("media_type"))
        else { return .unreadable }
        return .image(ImageBlock(
            mediaType: mediaType,
            base64: presentBytes(source.stringField("data")),
        ))
    }
}

/// An image type the record declared, or `nil` for anything else.
///
/// Gated on the media TYPE and never on the tool's name: the screenshot an agent looks at may
/// arrive from a read, a fetch or an MCP browser tool, and none of those names says "these are
/// pixels". A non-image binary read declares no image type, so it produces no media at all.
func imageMediaType(_ raw: String?) -> String? {
    guard let raw, raw.hasPrefix("image/") else { return nil }
    return raw
}

/// Base64 of whitespace is absent bytes rather than a zero-length image, so a row says it has
/// nothing to show instead of handing an empty source to a renderer.
func presentBytes(_ raw: String?) -> String? {
    guard let raw, !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
    return raw
}
