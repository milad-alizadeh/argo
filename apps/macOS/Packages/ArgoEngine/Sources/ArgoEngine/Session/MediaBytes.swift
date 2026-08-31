import Foundation

/// WHERE an image's bytes are, plus the head of them — never the bytes themselves.
///
/// Held, they were the largest thing in the app. Base64 is 1.33× the file it encodes, and a working
/// set of six real transcripts retained 69 MB of it: 98% of everything the event streams held, for
/// every Session in the set rather than the one on screen, for the life of the process. Addressed,
/// the same six retain 30 KB, and the transcript stays what it already was — the source of truth,
/// tailed incrementally, and cheap to read one run out of.
public struct MediaBytes: Sendable, Equatable, Hashable {
    /// Where the run IS.
    public enum Address: Sendable, Equatable, Hashable {
        /// A byte range of the transcript that carried it: the run's own first byte, counted from
        /// the start of the file. Read back with one seek and one read of exactly `count` bytes —
        /// no JSON parse, and nothing read that is not the picture.
        case run(transcript: String, at: Int)
        /// The picture file itself, at the path the call named. The `derived` reading, and re-read
        /// NOW for the same reason it is the lower tier: the caption already says "the file as it
        /// stands now", so a re-read is the claim rather than a weakening of it.
        case file(path: String)
        /// The base64 itself, for a reading with no file behind it — a fixture, or a line handed to
        /// the reader as a string. A live tail produces none of these.
        case held(base64: String)
    }

    public let address: Address
    /// The first 32 base64 characters, which is 24 bytes — past the last offset any image signature
    /// is read at. What lets a picture be told from a byte run that is not one with no read at all
    /// (`MediaDecode.isPicture`), which is the one question every projection asks of every shot.
    public let signature: String
    /// How long the whole run is. What a read is bounded by before it is made, and what a cost is
    /// predicted from before anything is decoded.
    public let count: Int

    public init(address: Address, signature: String, count: Int) {
        self.address = address
        self.signature = signature
        self.count = count
    }

    /// One run, addressed, with its signature and length taken off the base64 in hand.
    public init(address: Address, base64: String) {
        self.init(
            address: address,
            signature: String(base64.prefix(Self.signatureLength)),
            count: base64.utf8.count,
        )
    }

    /// The bytes themselves, for a reading with no file behind them.
    public static func held(_ base64: String) -> MediaBytes {
        MediaBytes(address: .held(base64: base64), base64: base64)
    }

    /// 32 base64 characters is 24 bytes, which is a whole number of base64 quanta — so this prefix
    /// is byte-for-byte the prefix of the whole run's own encoding, whichever end it is taken from.
    public static let signatureLength = 32

    /// What holding this costs the event stream it sits in, counting only the characters: the
    /// per-value overhead Swift adds is a constant, and a constant cannot hide a payload.
    public var retainedBytes: Int {
        signature.utf8.count + address.retainedBytes
    }

    /// A stable name for this run, for a cache that holds what it decoded to. Two runs of one
    /// picture in two files are two names, which costs a second decode and never a wrong picture.
    public var identity: String {
        switch address {
        case let .run(transcript, at): "\(transcript)#\(at)+\(count)"
        case let .file(path): "\(path)+\(signature)+\(count)"
        case .held: "held:\(signature)+\(count)"
        }
    }
}

private extension MediaBytes.Address {
    var retainedBytes: Int {
        switch self {
        case let .run(transcript, _): transcript.utf8.count + MemoryLayout<Int>.size
        case let .file(path): path.utf8.count
        case let .held(base64): base64.utf8.count
        }
    }
}
