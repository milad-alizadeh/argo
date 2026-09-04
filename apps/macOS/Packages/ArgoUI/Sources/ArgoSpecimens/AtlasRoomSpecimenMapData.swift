import Foundation

/// The fixture's own rows: where each file sits under the root, and what was measured about it.
///
/// Apart from `AtlasRoomSpecimenMap`, which nests them, because the caps this repository holds are
/// per file and a list of measurements is not a walk over one.
extension AtlasRoomSpecimenMap {
    static let measured: [Measured] = [
        (
            "apps/macOS/Packages/ArgoAtlas/Package.swift",
            ["lines": 39, "bytes": 1605, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoAtlas/Sources/AtlasLayout/"
                + "AtlasPlan.swift",
            ["lines": 25, "bytes": 1202, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoAtlas/Sources/AtlasView/"
                + "AtlasView.swift",
            ["lines": 49, "bytes": 1477, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoAtlas/Tests/AtlasLayoutTests/"
                + "AtlasPlanTests.swift",
            ["lines": 19, "bytes": 760, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Fixtures/settled-session.jsonl",
            ["lines": 4800, "bytes": 4_799_264, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Fixtures/settled-session.shape.json",
            ["lines": 48, "bytes": 1566, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Synthetic/SettledSessionFixture.swift",
            ["lines": 37, "bytes": 1909, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Synthetic/SyntheticIdentifiers.swift",
            ["lines": 61, "bytes": 2983, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Synthetic/SyntheticLorem.swift",
            ["lines": 82, "bytes": 3868, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Synthetic/SyntheticShape.swift",
            ["lines": 92, "bytes": 4094, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "Synthetic/SyntheticTranscript.swift",
            ["lines": 147, "bytes": 7762, "commits": 2, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Commands.swift",
            ["lines": 110, "bytes": 5223, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Fanout.swift",
            ["lines": 94, "bytes": 4477, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Fold.swift",
            ["lines": 131, "bytes": 6174, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Long.swift",
            ["lines": 143, "bytes": 5827, "commits": 2, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Looking.swift",
            ["lines": 56, "bytes": 2697, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Preview.swift",
            ["lines": 106, "bytes": 4860, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Prose.swift",
            ["lines": 52, "bytes": 3138, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Shots.swift",
            ["lines": 137, "bytes": 7385, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures+Work.swift",
            ["lines": 194, "bytes": 9478, "commits": 1, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoFixtures/"
                + "TranscriptFixtures.swift",
            ["lines": 114, "bytes": 5134, "commits": 2, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceDiff.swift",
            ["lines": 171, "bytes": 6246, "commits": 12, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceDocument.swift",
            ["lines": 31, "bytes": 1034, "commits": 2, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceHeader.swift",
            ["lines": 135, "bytes": 4910, "commits": 9, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceLength.swift",
            ["lines": 65, "bytes": 2752, "commits": 1, "authors": 1, "age_in_weeks": 3],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceMedia.swift",
            ["lines": 85, "bytes": 3758, "commits": 9, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceOutput.swift",
            ["lines": 103, "bytes": 4315, "commits": 9, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidencePanel.swift",
            ["lines": 121, "bytes": 4766, "commits": 13, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceReading.swift",
            ["lines": 33, "bytes": 1219, "commits": 4, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/"
                + "Evidence/EvidenceSource.swift",
            ["lines": 54, "bytes": 2215, "commits": 5, "authors": 1, "age_in_weeks": 0],
        ),
        (
            "docs/designs/composer-picker/at-filter.png",
            ["bytes": 325_070, "commits": 1, "authors": 1, "age_in_weeks": 3],
        ),
        (
            "docs/designs/composer-picker/at-inserted.png",
            ["bytes": 285_728, "commits": 1, "authors": 1, "age_in_weeks": 3],
        ),
        (
            "docs/designs/composer-picker/at.png",
            ["bytes": 445_989, "commits": 1, "authors": 1, "age_in_weeks": 3],
        ),
        (
            "docs/designs/composer-picker/codex.png",
            ["bytes": 254_864, "commits": 1, "authors": 1, "age_in_weeks": 3],
        ),
    ]
}
