import ArgoUI

extension ConnectFixture {
    static let codexSettings = ConnectReading(
        folder: folder,
        accounts: [personal, work],
        ports: wired.ports,
        mode: .settings(agent: .codex),
    )
}
