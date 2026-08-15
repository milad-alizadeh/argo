/// How long each step of the Help-panel drive waits, and how many times it asks (#686).
struct HelpPanelPace: Sendable {
    var untilReady: Duration = .seconds(8)
    var untilTyped: Duration = .milliseconds(1500)
    var untilOpen: Duration = .seconds(4)
    var untilDrawn: Duration = .seconds(4)
    /// Three rather than two, so a machine slower than the one this was measured on still has an
    /// attempt in hand.
    var attempts = 3

    /// No waiting and one attempt, for a test whose stand-in terminal paints the same screen
    /// however many times it is asked.
    static let none = HelpPanelPace(
        untilReady: .zero,
        untilTyped: .zero,
        untilOpen: .zero,
        untilDrawn: .zero,
        attempts: 1,
    )
}
