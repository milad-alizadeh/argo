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

extension CockpitPresentation.Session {
    /// What a turn that rendered something produced: four pictures back to back, and one call the
    /// record answered with no bytes at all. Every provenance the cockpit can tell apart is in
    /// here, because they are told apart by how they are DRAWN.
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
                status: .completed,
                result: .media(MediaEvidence(
                    tier: shot.tier,
                    mediaType: "image/png",
                    bytes: shot.bytes.map(unwrapped),
                )),
                endedAtMs: nil,
                usage: nil,
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
        MediaEvidence(tier: .direct, mediaType: "image/png", bytes: unwrapped(wrapped))
    }

    /// A transcript writes base64 as one unbroken run; source cannot hold a 1000-character line.
    /// The wrapping is this file's, so it comes off here rather than in the decoder: production
    /// bytes have no newlines and nothing should tolerate any.
    private static func unwrapped(_ wrapped: String) -> String {
        wrapped.replacingOccurrences(of: "\n", with: "")
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

    /// The same shell a moment later, one row selected — two captures of the same surface.
    private static let selectionCapture = """
    iVBORw0KGgoAAAANSUhEUgAAAUAAAADICAIAAAAWZq/8AAACzElEQVR42u3csQmAMBRF0UwiFoqIKNhYOp6d
    nZ3DaqlgK2KSA3eChNN9XhjGSVKkBU8gASwJYEkASwBLAlgSwJIAlgCWBLAkgCWAJQEsCWBJAEsASwJYEsCS
    AJYAlgSwJIAlgCUBLAlgSQBLAEsCWNKbgOumzaGirKT0AlgCGGAJYIAlgAEWwABLAAMsAQywBLAEMMASwABL
    AAMsgAGWAAZYAhhgCWCABTDAEsAASwADLAEsAQywBDDAEsAAC2CAHy3rpo/DEmCAAQYYYIABBhhgAQwwwAAL
    YIABBhhgAQwwwAIYYIABBhhggAEG2CmlBDDAEsAAC2CAJYABlgAGWLoAz/txr+vHJPPTAhhgCWCAJYABlgCW
    AAZYAhhgCWCABTDAEsAASwADLAEsAZwVYAM3Zm4ABhhgAQwwwAIYYIABBhhgAQwwwAIYYIABBhhggAEGGGAB
    DDDAAtgppQAGWPonYMPuEsAASwADLAEMsAAGWAIYYAlggCWAJYABlgAGWAIYYAEMsAQwwBLAAEsAAyyAAZYA
    jhWwMR1bPwADLIABBlgAAwwwwAADLIABBlgAAwwwwAADDDDAAAMsgAEGWAAD7JRSAAMsAQywBDDAEsASwABL
    AAMsAQywAAZYAhhgCWCAJYD9tAAGWAIYYAlggCWAJYABlgAGWALYpI7dGYABBlgAAwywAAYYYAEMsAAGGGAB
    DDDAAhhggAEGGGABDDDAAtgppQQwwAIYYAlggCWAAZYAlgAGWAIYYAlggAUwwBLAAEsAAywBDLAABlgCGGAJ
    YIAlgCWAAZYABlgCGGABDLAEMMASwABLAPtsAQywBDDAEsAAC2CAJYABlgAGWAIYYAEMsAQwwBLAAEsASwAD
    LAEMsAQwwAIYYAlggCWAAZYABlgAAywBDLAEMMASwBLAAEsAAywBDLAABlgCGGAJYIAlgAEWwABLv+sEanug
    2Oh4vwkAAAAASUVORK5CYII=
    """

    /// Not a screenshot: an artifact the companion plugin drew and reported.
    private static let renderedChart = """
    iVBORw0KGgoAAAANSUhEUgAAASwAAAC0CAIAAAChXYa4AAAC0UlEQVR42u3TwQ2AIBBFQXry4gkKtU1DuEEL
    miDBzSSvgv076TjL3O7aJD0vQShBKEEIoQShBCGEEoQShBBKEEoQQihBKEEIoQShBCGEEoQShBBKEEoQQihB
    KEEIoQShBCGEEoQShBBKEEoQQihBKEEIoQShBCGEilC++vQglCA0rSCEUIJQghBCCUIJQgglCCUIIZQglCCE
    UIJQghBCCUIJQgg93A4/ByGEEEIIoSCEEEIIIYRQEEIIIYQQQigIIYQQQgghFIQQQgghhBAKQgghhBBCCAUh
    hBBCCCGEghBCCCGEEEJBCCGEEEIIoSCEEEIIIYRQEEIYAKGHgxBC94UQQgg9HIQQQgghhBB6OAghhBBCCCH0
    cBBCCCGEEELo4SCEEEIIIYTQw7kJhBBCCCGEHs5NIIQQQk8CoYdzEwghhNCTQOjh3ARCCCH0JBB6ODeBEEII
    IYTQw7kJhBBCCCGEHm7pTfaZBkIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGE
    EEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCP+F0NIQQgghhBBCaGkIIYQQQggh
    tDSEEEIIIYQQWhpCCCGEEEIILQ0hhBBCCCGEEEIIIYQQQgghhBBCCCGEpoEQQgghhBBC00AIIYQQQgihaSC0
    dJiDmAZCS0MIIYQQmgZCS0MIIYQQmgZCS0MIIYQQmgZCS0MIIYQQmgZCS0MIoaUhNA2EloYQQktDaBoILQ0h
    hJaG0DQQWhpCCC0NoWkgtDSEEFoaQtNAaGkIIbQ0hKaBEELTQGhpCE0DIYSmgdDSEJoGQghNA6GlITTNlwgl
    vQpCCUIJQkkQShBKglCCUBKEEoSSIJQglAShBKEkCCUIJUEoQSgJQglCSRBKEEqCUIJQEoRSvAbTPsDx1ZH4
    4wAAAABJRU5ErkJggg==
    """

    /// A re-read of a path that has already moved on. Its own picture, visibly unlike the two
    /// captures.
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
