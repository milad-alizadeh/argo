import Foundation

/// Image-bearing transcripts on disk, of the shape and size real ones are: one record per picture,
/// the base64 carried twice as the host writes it, and prose around it.
///
/// Written rather than checked in: the whole point is a payload big enough that retaining it is
/// visible, and a megabyte of base64 per picture does not belong in a fixture folder.
final class MediaTranscriptFixture {
    let folder: URL
    let urls: [URL]
    /// Every picture in every file, so a census can be read against what was written.
    let pictures: Int

    init(sessions: Int, picturesEach: Int, kilobytesEach: Int) throws {
        let folder = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("argo-media-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        self.folder = folder
        self.pictures = sessions * picturesEach
        self.urls = try (0 ..< sessions).map { session in
            let url = folder.appendingPathComponent("session-\(session).jsonl")
            let lines = (0 ..< picturesEach).flatMap { picture in
                Self.records(session: session, picture: picture, kilobytes: kilobytesEach)
            }
            try lines.joined(separator: "\n").appending("\n")
                .write(to: url, atomically: true, encoding: .utf8)
            return url
        }
    }

    deinit { try? FileManager.default.removeItem(at: folder) }

    /// The call, and the record answering it with a picture.
    private static func records(session: Int, picture: Int, kilobytes: Int) -> [String] {
        let id = "shot-\(session)-\(picture)"
        let base64 = base64(kilobytes: kilobytes, salt: id)
        return [
            """
            {"type":"assistant","uuid":"a-\(id)","timestamp":"2026-08-01T09:00:00.000Z",\
            "message":{"role":"assistant","stop_reason":"tool_use","content":[\
            {"type":"text","text":"looking at the render"},\
            {"type":"tool_use","id":"\(id)","name":"Read",\
            "input":{"file_path":"/tmp/\(id).png"}}]}}
            """,
            """
            {"type":"user","uuid":"r-\(id)","timestamp":"2026-08-01T09:00:01.000Z",\
            "message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"\(id)",\
            "content":[{"type":"image","source":{"type":"base64","data":"\(base64)",\
            "media_type":"image/png"}}]}]},\
            "toolUseResult":{"type":"image","file":{"base64":"\(base64)","type":"image/png"}}}
            """,
        ]
    }

    /// A run of base64 that is a PNG by its signature, sharing its first 24 bytes with every other
    /// run here and unique after them.
    ///
    /// Shared deliberately: a real PNG's first 24 bytes are the signature, the IHDR length and tag
    /// and the two dimensions, so two captures of one window size are identical that far in — and
    /// addressing a run by its head put the second of two at the first's offset (#989). Unique
    /// after them because two pictures sharing a whole run share an address, which would leave a
    /// census measuring deduplication.
    static func base64(kilobytes: Int, salt: String) -> String {
        var bytes = Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        bytes.append(Data(repeating: 0x49, count: 16))
        bytes.append(Data(salt.utf8))
        var seed = UInt64(truncatingIfNeeded: salt.hashValue) | 1
        while bytes.count < kilobytes * 1000 {
            seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            bytes.append(UInt8(truncatingIfNeeded: seed >> 33))
        }
        return bytes.base64EncodedString()
    }
}
