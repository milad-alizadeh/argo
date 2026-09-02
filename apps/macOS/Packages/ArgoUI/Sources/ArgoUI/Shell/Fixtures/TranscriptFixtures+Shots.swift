import ArgoEngine

/// One picture in the preview transcript, before it is written out as the pair of events a CLI
/// actually emits. At file scope because three levels of type is one more than the house allows.
private struct PreviewShot {
    let id: String
    let path: String
    let tier: Tier
    /// Base64, wrapped across source lines. `nil` for the call the record answered without any.
    let bytes: String?
}

extension TranscriptFixtures {
    /// What a turn that rendered something produced: four pictures back to back, and one call the
    /// record answered with no bytes at all. Every provenance the cockpit can tell apart is in
    /// here, because they are told apart by how they are DRAWN.
    ///
    /// Four SHAPES too — landscape, a wide chart, a square and a tall column. A gallery draws each
    /// at its own ratio (#1015), so a set that was all one shape could not show the band doing it.
    static let shotsTaken: [TranscriptEvent] = [
        PreviewShot(
            id: "shot-rest", path: "docs/designs/renders/feed-at-rest.png",
            tier: .direct, bytes: shellCapture,
        ),
        PreviewShot(
            id: "shot-gone", path: "docs/designs/renders/lightbox.png",
            tier: .direct, bytes: nil,
        ),
        PreviewShot(
            id: "shot-chart", path: "docs/designs/renders/churn-by-week.png",
            tier: .convention, bytes: renderedChart,
        ),
        PreviewShot(
            id: "shot-disk", path: "Sources/ArgoUI/Specimen/feed-calls.png",
            tier: .derived, bytes: diskPlate,
        ),
        PreviewShot(
            id: "shot-open", path: "docs/designs/renders/feed-row-open.png",
            tier: .direct, bytes: selectionCapture,
        ),
    ].flatMap(showed)

    private static func showed(_ shot: PreviewShot) -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(
                id: shot.id, name: "Read", kind: .read, target: shot.path, atMs: nil,
            )),
            .toolCallOutcome(ToolCallOutcome(
                id: shot.id,
                resolution: ToolCallOutcome.Resolution(
                    status: .completed,
                    result: .media(MediaEvidence(
                        tier: shot.tier,
                        mediaType: "image/png",
                        bytes: shot.bytes.map { .held(unwrapped($0)) },
                    )),
                    endedAtMs: nil,
                ),
            )),
        ]
    }

    /// A picture pasted into a prompt, as the reader ends up with it: the placeholder the CLI wrote
    /// beside the pixels is already taken out. The three shapes one renders in — beside words, on
    /// its own, and two side by side.
    static let pasted: [TranscriptEvent] = [
        .prompt(
            text: "Look at the rule under the header — it sits a point low against the seam.",
            images: [picture(shellCapture)],
            atMs: 1_733_000_100_000,
        ),
        .prompt(text: "", images: [picture(selectionCapture)], atMs: 1_733_000_110_000),
        .prompt(
            text: "And these two side by side.",
            images: [picture(renderedChart), picture(diskPlate)],
            atMs: 1_733_000_120_000,
        ),
    ]

    /// DIRECT for all of them: a pasted picture is bytes the record carried.
    private static func picture(_ wrapped: String) -> MediaEvidence {
        MediaEvidence(tier: .direct, mediaType: "image/png", bytes: .held(unwrapped(wrapped)))
    }

    /// The cockpit at rest, as the agent captured it.
    private static let shellCapture = """
    iVBORw0KGgoAAAANSUhEUgAAAUAAAADICAIAAAAWZq/8AAACu0lEQVR42u3cMQqAIBiGYU8SDkW4CC0e0a2t
    A3sAl4aI0gfeEyjP9vOFfBRJPy14AglgSQBLAlgCWBLAkgCWBLAEsCSAJQEsASwJYEkASwJYAlgSwJIAlgSw
    BLAkgCUBLAEsCWBJAEsCWAJYEsCSngS87WmGlrhK4wWwBDDAEsAASwADLIABlgAGWAIYYAlgCWCAJYABlgAG
    WAADLAEMsAQwwBLAAAtggCWAAZYABlgCWAIYYAlggCWAARbAAHfV89LLYQkwwAADDDDAAAMMsAAGGGCABTDA
    AAMMsAAGGGABDDDAAAMMMMAAA+yUUgIYYAlggAUwwBLAAEsAAywBLAEMsAQwwBLAAAtggCWAAZYABlgCGGAB
    DLAEMMASwABLAEsAm9QxcyOAAQZYAAMMMMAAAwwwwAADLIABBlgAAwwwwAADLIABBlgAAwwwwABLAAMsAQyw
    BDDAAhhgCWCAJYABlgCWAAZYAhhgCWCABTDAEsAASwADLAEMsAAGWAIYYAlggCWA72VMx9YPwAALYIABFsAA
    AwwwwAALYIABFsAAAwwwwAADDDDAAAtggAEWwAA7pRTAAEsAAywBDLAEsAQwwBLAAEsAAyyAAZYABlgCGGAJ
    YD8tgAGWAAZYAhhgCWAJYIAlgAGWADapY3cGYIABFsAAAyyAAQZYAAMsgAEGWAADDLAABhhggAEGWAADDLAA
    dkopAQywAAZYAhhgCWCAJYAlgAGWAAZYAhhgAQywBDDAEsAASwADLIABlgAGWAIYYAlgCWCAJYABlgAGWAAD
    LAEMsAQwwBLAPlsAAywBDLAEMMACGGAJYIAlgAGWAAZYAAMsAQywBDDAEsASwABLAAMsAQywAAZYAhhgCWCA
    JYABFsAASwADLAEMsASwBDDAEsAASwADLIABlgAGWAIYYAlggAUwwNLnah+Lc2HXnYThAAAAAElFTkSuQmCC
    """

    /// The same shell a moment later, one row selected, cropped to the deck's own column — a TALL
    /// capture, which the band draws narrow.
    private static let selectionCapture = """
    iVBORw0KGgoAAAANSUhEUgAAAMgAAAGkBAMAAACGN3c4AAAAMFBMVEWGjZR/h415gIZzeoBscnhSVlxNUlc4O0A2OT4uMTYs
    LzQrLTIlJiskJisgIiYeICS4CDg5AAABL0lEQVR42u3bwQnCMABA0UQyQN1Aikt468GjV1cQnMA1vDqLjqArOIK6gR48B6qk
    KZT3r1IfpYUmaRpPYfhmAQKBQCAQCAQCgUAgEAgEAoFAIBBIpjSvgMRHDeTtwkMgEAgEAoFAIBAIBAKBQNKtAhLXQZIkTbBY
    48VZ2nlxBoFAIBAIBAKBQCCQEZF0Kfdfy0VuYtqWm+NujrkzuZdDXu4uCAQCgUB6DSQKPuOb7C/nGqMVy+gQCAQCgUAgEAgE
    AsnNGQ9T2akmSZKqV+WLs3gNdqNDIBAIBAKBQCAQCGQ8JG7/OGbfhcG3vMfVr8iz5LZzdxcEAoFAIH0ev/8MJLoKy+ixbSyj
    QyAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIJBvH5zIF1tA6Cr5AAAAAElFTkSuQmCC
    """

    /// Not a screenshot: an artifact the companion plugin drew and reported. A chart is a WIDE
    /// picture, and the band draws it wide.
    private static let renderedChart = """
    iVBORw0KGgoAAAANSUhEUgAAAeAAAACMBAMAAABWu2czAAAAMFBMVEX09vjz9vjs8vjp8Pjo8Pjd6/jG3/nDx8mZyfyZyPts
    sv5Vpv9Kof8+m/87g88zOD8+32iaAAABLElEQVR42u3bMWoCQRQG4FkRxS4J2Ft4AMELWASrFLmAbUBstPIUnsAr2HkQy72C
    jX0C6qa1eE2Mio7f380PM/CxM9VjiyoF+W6lG2bxGdblx18PapRhvZ6eLGrpyQIMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAx8
    durnb20PorZaZQsezqL2mC+4eI3agzcMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDJweeiB+0xT9l6jebXIF1+YheDvK
    9gu/daL6xxsGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGTv+ZD3+FbbXMFdych/Vh6UoDAwMDAwMDAwMDAwMDAwMDAwMD
    AwMDAwMnw7RrZdyL2v0kW3D3PV3kp1BXGhgYGBgYGBgY+N7yCyQWGQ1y/qRTAAAAAElFTkSuQmCC
    """

    /// A re-read of a path that has already moved on. Its own picture, visibly unlike the two
    /// captures, and SQUARE — the shape a fixed 3:2 plate cut the most off.
    private static let diskPlate = """
    iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAIAAACxN37FAAACKElEQVR42u3csQkAIAxFwayh4EpWVu4/SMBa
    xE6Qg5sgefWPUht8I5wAQYOgQdAgaAQNggZBg6BB0AgaBA2CBkGDoBE0CBoEDYIGQSNoEDQIGgQNgkbQIGgQ
    NAgaBI2gQdAgaBA0CBpBg6BB0CBoBA2CBkGDoOF90H1MOBM0ghY0ghY0ghY0gkbQgkbQgkbQgkbQgkbQCFrQ
    CFrQCFrQCNrDEDSCFjSCFjSCFjSCBkEjaEEjaEEjaEEjaBA0ghY0ghY0ggbroyBoEDSCBkGDoEHQIGgEDYIG
    QYOgQdAIGgQNggZBg6ARNAgaBA2CBkEjaBA0CBoEDYJG0PdMa2JOF0ELGkELGkELGkGDoBG0oBG0oBG0oBE0
    CBpBCxpBCxpBCxpBg6ARtKARtKARtKARNAgaQQsaQQsaQQsaQSNoQSNoQSNoQSNoMKcLggZBI2gQNAgaBA2C
    RtAgaBA0CBoEjaBB0CBoEDQIGkGDoEHQIGgEDYIGQYOgQdAIGgS9Z1oTc7oIWtAIWtAIWtAIGgSNoAWNoAWN
    oAWNoEHQCFrQCFrQCFrQCBoEjaAFjaAFjaAFjaBB0Aha0Aha0Aha0AgaQQsaQQsaQQsaQYM5XRA0CBpBg6BB
    0CBoEDSCBkGDoEHQIGgEDYIGQYOgQdAIGgQNggZBI2gQNAgaBA2CRtAgaBA0CBoEjaBB0CBoEDQIGkGDoEHQ
    IGgQNIIGQYOgQdAgaAQNggZBg6BhSZ8xpHpCJYrTAAAAAElFTkSuQmCC
    """
}
