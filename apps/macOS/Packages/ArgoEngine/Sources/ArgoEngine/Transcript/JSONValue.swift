import Foundation

// The untrusted-input primitive. A model wrote the transcript, so no line is trusted to have the
// shape it should, and `Codable`'s strictness is the wrong tool at this boundary: a struct with a
// `String` field throws on `{"type": "text", "text": 12}` and takes the whole record down with it.
// So the JSON is decoded WITHOUT a schema first, and every typed reading is a total function over
// the result — a value is a string only when it is one, and anything else reads as absent rather
// than as a default or a thrown error.

/// One JSON value, decoded without knowing its shape.
public enum JSONValue: Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([JSONValue])
    case object([String: JSONValue])
    case null
}

extension JSONValue: Decodable {
    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        // Bool before Double: JSON's `true` is not a number, but a decoder asked for one after
        // the fact will have already consumed the value.
        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let number = try? container.decode(Double.self) {
            self = .number(number)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([JSONValue].self) {
            self = .array(array)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }
}

public extension JSONValue {
    /// One line of a `.jsonl` transcript, or `nil` where it is not a JSON object.
    ///
    /// An object specifically, not any JSON: the fixtures carry `[]`, `"a string"`, `null` and a
    /// truncated `{"type":"user"` on their own lines, and none of those is a record. A malformed
    /// line is never thrown on — the caller decides what to do with a line it could not read.
    static func record(fromLine line: String) -> JSONValue? {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else { return nil }
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: data) else { return nil }
        guard case .object = value else { return nil }
        return value
    }

    var string: String? { if case let .string(value) = self { value } else { nil } }

    var bool: Bool? { if case let .bool(value) = self { value } else { nil } }

    /// Finite numbers only: a JSON `NaN` cannot be written, but a value read as a number and used
    /// as a length or an offset must be one.
    var number: Double? {
        guard case let .number(value) = self, value.isFinite else { return nil }
        return value
    }

    var int: Int? { number.map { Int($0) } }

    /// Absent and present-but-not-an-array read alike: both are "no elements to walk".
    var array: [JSONValue] { if case let .array(value) = self { value } else { [] } }

    var object: [String: JSONValue]? { if case let .object(value) = self { value } else { nil } }

    /// Read one field, absent unless this is an object that has it.
    subscript(key: String) -> JSONValue? { object?[key] }

    /// Read one field as a string, absent unless it is one.
    func stringField(_ key: String) -> String? { self[key]?.string }
}
