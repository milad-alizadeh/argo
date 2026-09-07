import CryptoKit
import Darwin
import Foundation

/// RFC 6455 on the wire: accepting the raw connection, reading the upgrade request, answering it,
/// and framing text both ways. Free of `LocalWebSocketServer`'s actor isolation — every function
/// here takes the file descriptor it needs rather than reading the actor's own state, which is what
/// lets it run on the background thread the blocking `Darwin` calls require.
enum WebSocketFrame {
    /// GUID `RFC 6455` fixes for every `Sec-WebSocket-Accept`.
    private static let magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    static func accept(on listening: Int32) async -> Int32? {
        await withCheckedContinuation { continuation in
            DispatchQueue.global().async {
                let accepted = Darwin.accept(listening, nil, nil)
                continuation.resume(returning: accepted >= 0 ? accepted : nil)
            }
        }
    }

    struct Request {
        let headers: [String: String]
    }

    /// Reads the handshake request up to the blank line that ends it, headers lower-cased by name.
    static func readRequest(from client: Int32) -> Request? {
        var raw: [UInt8] = []
        var buffer = [UInt8](repeating: 0, count: 1)
        while raw.count < 4 || raw.suffix(4) != [13, 10, 13, 10] {
            let count = Darwin.read(client, &buffer, 1)
            guard count == 1 else { return nil }
            raw.append(buffer[0])
        }
        guard let text = String(bytes: raw, encoding: .utf8) else { return nil }
        var headers: [String: String] = [:]
        for line in text.split(separator: "\r\n").dropFirst() {
            let halves = line.split(separator: ":", maxSplits: 1)
            guard halves.count == 2 else { continue }
            let name = halves[0].trimmingCharacters(in: .whitespaces).lowercased()
            let value = halves[1].trimmingCharacters(in: .whitespaces)
            headers[name] = value
        }
        return Request(headers: headers)
    }

    static func answer(_ client: Int32, key: String) {
        let accepted = Insecure.SHA1.hash(data: Data((key + magic).utf8))
        let accept = Data(accepted).base64EncodedString()
        let response = """
        HTTP/1.1 101 Switching Protocols\r
        Upgrade: websocket\r
        Connection: Upgrade\r
        Sec-WebSocket-Accept: \(accept)\r
        \r

        """
        _ = Array(response.utf8).withUnsafeBytes { Darwin.write(client, $0.baseAddress, $0.count) }
    }

    /// One text frame, unmasked as the server side of RFC 6455 requires.
    static func write(_ text: String, to client: Int32) {
        let payload = Array(text.utf8)
        var frame: [UInt8] = [0x81] // FIN + text opcode
        frame.append(contentsOf: length(payload.count, masked: false))
        frame.append(contentsOf: payload)
        _ = frame.withUnsafeBytes { Darwin.write(client, $0.baseAddress, $0.count) }
    }

    static func readClientFrame(from client: Int32) async -> String? {
        await withCheckedContinuation { continuation in
            DispatchQueue.global().async {
                continuation.resume(returning: Self.readFrame(client))
            }
        }
    }

    private static func length(_ count: Int, masked: Bool) -> [UInt8] {
        let maskBit: UInt8 = masked ? 0x80 : 0
        if count < 126 {
            return [maskBit | UInt8(count)]
        } else if count <= 0xFFFF {
            return [maskBit | 126, UInt8(count >> 8), UInt8(count & 0xFF)]
        }
        let bytes = (0 ..< 8).reversed().map { UInt8((count >> ($0 * 8)) & 0xFF) }
        return [maskBit | 127] + bytes
    }

    private static func readFrame(_ client: Int32) -> String? {
        var header = [UInt8](repeating: 0, count: 2)
        guard Darwin.read(client, &header, 2) == 2 else { return nil }
        let masked = header[1] & 0x80 != 0
        var length = Int(header[1] & 0x7F)
        if length == 126 {
            var extended = [UInt8](repeating: 0, count: 2)
            guard Darwin.read(client, &extended, 2) == 2 else { return nil }
            length = Int(extended[0]) << 8 | Int(extended[1])
        } else if length == 127 {
            var extended = [UInt8](repeating: 0, count: 8)
            guard Darwin.read(client, &extended, 8) == 8 else { return nil }
            length = extended.reduce(0) { $0 << 8 | Int($1) }
        }
        var maskKey = [UInt8](repeating: 0, count: 4)
        if masked {
            guard Darwin.read(client, &maskKey, 4) == 4 else { return nil }
        }
        var payload = [UInt8](repeating: 0, count: length)
        var read = 0
        while read < length {
            let count = Darwin.read(client, &payload[read], length - read)
            guard count > 0 else { return nil }
            read += count
        }
        if masked {
            for index in payload.indices {
                payload[index] ^= maskKey[index % 4]
            }
        }
        return String(bytes: payload, encoding: .utf8)
    }
}
