@testable import AtlasLayout
import Foundation

/// The repository the two domain suites read: four files over three folders, two of which the
/// inference calls one subject — the shape the whole feature exists for, at the smallest size that
/// shows it (#1158).
///
/// Beside the suites rather than inside one of them, because both the reshuffle and the list
/// beside it are claims about the SAME repository: built twice, the day one copy grew a folder
/// would be the day the two suites stopped describing one map.
enum AtlasRegroupingFixture {
    static func map(
        inference: AtlasInference?,
        measures: [String: Double] = ["lines": 10],
    )
        -> AtlasMap {
        AtlasMap(
            measuredAt: Date(timeIntervalSince1970: 1_756_951_037),
            commit: nil,
            root: AtlasPlate(path: "argo", children: [
                .plate(AtlasPlate(path: "argo/feed", children: [
                    .plot(AtlasPlot(path: "argo/feed/turn.swift", measures: measures)),
                ])),
                .plate(AtlasPlate(path: "argo/roster", children: [
                    .plate(AtlasPlate(path: "argo/roster/rows", children: [
                        .plot(AtlasPlot(path: "argo/roster/rows/turn.swift", measures: measures)),
                    ])),
                    .plot(AtlasPlot(path: "argo/roster/clock.swift", measures: measures)),
                ])),
                .plot(AtlasPlot(path: "argo/README.md", measures: measures)),
            ]),
            relations: AtlasRelations(inference: inference),
        )
    }

    /// The Domains, ranked by where they stand in the list — which is what the Map file spells by
    /// writing them in that order, and what a decoded Map arrives carrying.
    static func inference(
        _ domains: [AtlasDomain],
        settled: Bool = true,
    )
        -> AtlasInference {
        AtlasInference(
            domains: domains.enumerated().map { rank, domain in
                AtlasDomain(
                    name: domain.name,
                    tokens: domain.tokens,
                    members: domain.members,
                    rank: rank,
                )
            },
            resolution: 1.1,
            settled: settled,
            agreement: 0.9,
        )
    }

    /// The subject the folder tree keeps apart: one `turn.swift` under `feed` and another under
    /// `roster/rows`.
    static let turns = AtlasDomain(name: "turn", tokens: ["turn"], members: [
        AtlasDomainMember(path: "argo/feed/turn.swift", confidence: 0.8),
        AtlasDomainMember(path: "argo/roster/rows/turn.swift", confidence: 0.6),
    ])

    /// One file of its own, so a second Domain has a rank to keep and a colour to be given.
    static let clocks = AtlasDomain(name: "clock", tokens: ["clock"], members: [
        AtlasDomainMember(path: "argo/roster/clock.swift", confidence: 0.4),
    ])
}
