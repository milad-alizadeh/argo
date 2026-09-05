/// The inference exactly as the Map file writes it (#1157).
///
/// The two numbers come FIRST in the type for the same reason they are stored at all: a reader
/// that takes the Domains without them has taken a guess for a measurement.
struct AtlasInferenceWire: Codable {
    let resolution: Double
    let settled: Bool
    let agreement: Double?
    let domains: [AtlasDomainWire]
}

/// One Domain as the file writes it. Its members are POSITIONS in the Map's own Plot order rather
/// than paths, the same economy the Couplings are written with: the file already names every file
/// once, in the nesting, and this repository's Domains hold a position for every file it measures.
struct AtlasDomainWire: Codable {
    let name: String
    let tokens: [String]
    let members: [AtlasDomainMemberWire]
}

/// One file's place in a Domain: which Plot, and the margin it held the Domain by.
struct AtlasDomainMemberWire: Codable {
    let plot: Int
    let confidence: Double
}
