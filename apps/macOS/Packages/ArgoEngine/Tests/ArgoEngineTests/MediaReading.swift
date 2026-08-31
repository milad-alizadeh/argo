@testable import ArgoEngine

/// One read of a set of transcripts, and what holding it cost. The report's own value, so the
/// measurement itself is three lines with nothing between the two memory readings.
struct MediaReading {
    let events: Int
    let pictures: Int
    /// Every picture's address, kept so the read-back check can run AFTER the memory readings:
    /// resolving 224 real captures churns 69 MB through malloc, and inside the readings it is what
    /// they would be measuring.
    let addresses: [MediaBytes]
    var readable = 0
    /// The base64 those pictures are, whole — what the streams retained before #989 addressed them.
    let payload: Int
    let retained: Int
    let census: String
    let kinds: String
    let heldHeap: Int
    var releasedHeap = 0
    var peakFootprint = 0
    let cpu: Double

    init(_ read: [[TranscriptEvent]], heldHeap: Int, cpu: Double) {
        let pictures = read.flatMap(mediaEvidence)
        let addressed = pictures.compactMap(\.bytes)
        self.events = read.map(\.count).reduce(0, +)
        self.pictures = pictures.count
        self.addresses = addressed
        self.payload = read.reduce(0) { $0 + mediaPayloadBytes(in: $1) }
        self.retained = read.reduce(0) { $0 + retainedMediaBytes(in: $1) }
        self.census = Self.tally(read.reduce(into: [:]) { whole, events in
            for (kind, bytes) in censusByKind(events) {
                whole[kind, default: 0] += bytes
            }
        })
        self.kinds = Self.tally(
            Dictionary(grouping: addressed) { $0.address.kind }
                .mapValues(\.count),
            scale: 1,
            unit: "",
        )
        self.heldHeap = heldHeap
        self.cpu = cpu
    }

    var addressed: Int {
        addresses.count
    }

    /// The read-back check, run once the memory has been read: how many of those addresses still
    /// hand back their bytes.
    mutating func resolve() {
        readable = addresses.count { mediaData(at: $0) != nil }
    }

    func report(of bytesOnDisk: Int) -> String {
        """
        REAL-TRANSCRIPT MEASUREMENT
          bytes on disk       \(bytesOnDisk / 1_000_000) MB
          events retained     \(events)
          pictures            \(pictures), \(addressed) addressed, \(readable) read back
          picture payload     \(payload / 1000) KB
          picture retained    \(retained / 1000) KB
          live heap held      +\(heldHeap / 1000) KB
          live heap released  +\(releasedHeap / 1000) KB
          peak footprint      +\(peakFootprint / 1_000_000) MB
          read CPU            \(String(format: "%.2f", cpu)) s
          address kinds       \(kinds)
          census by kind      \(census)
        """
    }

    /// Biggest first, which is the only order a reader of one of these wants.
    private static func tally(_ counts: [String: Int], scale: Int = 1000, unit: String = " KB")
        -> String {
        counts.sorted { $0.value > $1.value }
            .map { "\($0.key) \($0.value / scale)\(unit)" }
            .joined(separator: ", ")
    }
}
