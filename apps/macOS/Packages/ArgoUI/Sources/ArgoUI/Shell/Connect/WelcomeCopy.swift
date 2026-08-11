/// What the Welcome screen says, as values rather than literals inside a `body`.
///
/// Its own type, outside the view, for two reasons. The copy rules this flow carries — no em dash,
/// no honesty tier, no borrowed status word — are claims about every word on screen, and a string
/// inside a `body` is a string no test can reach. And a `View` is `@MainActor`, so copy declared on
/// one cannot be read by a suite that is not.
enum WelcomeCopy {
    /// One promise, said once. A value rather than three copies of a `VStack`, because the three
    /// differ in their words and in nothing else.
    struct Benefit: Identifiable {
        let title: String
        let detail: String

        var id: String {
            title
        }
    }

    static let heading = "Argo watches the agents you run."
    static let subheading = "Point it at a folder and it starts there. Everything else is optional."
    static let start = "Get started"

    static let benefits = [
        Benefit(
            title: "Every session in one window",
            detail: "See what each agent is doing, and step in when one needs you.",
        ),
        Benefit(
            title: "Read the work, not just the result",
            detail: "Follow what an agent changed, ran and asked, as it happens.",
        ),
        Benefit(
            title: "Your issues and pull requests beside it",
            detail: "Connect an account and the backlog, reviews and checks come with it.",
        ),
    ]

    static let all = [heading, subheading, start] + benefits.flatMap { [$0.title, $0.detail] }
}
