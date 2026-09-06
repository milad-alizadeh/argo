import Foundation

/// The claims of a JWT, read without verifying it.
///
/// **Nothing here is a security check, and no decision rests on it.** The token was handed to Argo
/// by the CLI that owns it, off a file only this user can read, and the two claims taken out of it
/// are rendered as an attribution rather than trusted for access. Verifying a signature Argo has no
/// key for would prove nothing anyway.
enum JWTPayload {
    /// The middle segment's object, or nothing where the token is not three base64url segments
    /// around one.
    static func decode(_ token: String) -> [String: Any]? {
        let segments = token.split(separator: ".")
        guard segments.count == 3, let data = base64URL(String(segments[1])) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// base64url is base64 with two characters swapped and the padding dropped, so both are put
    /// back before `Data` reads it.
    private static func base64URL(_ segment: String) -> Data? {
        var text = segment.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        text += String(repeating: "=", count: (4 - text.count % 4) % 4)
        return Data(base64Encoded: text)
    }
}
