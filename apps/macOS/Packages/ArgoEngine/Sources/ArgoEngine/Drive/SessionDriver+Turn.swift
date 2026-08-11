import Foundation

public extension SessionDriver {
    /// One Turn with the files it names (#538, #540). The attachments go first and the Turn NAMES
    /// what they became, so the agent's own `Read` pulls the bytes in. Both halves are on one
    /// throwing path: a write that failed must not be followed by a message naming a file that is
    /// not there.
    func send(
        _ text: String,
        attaching attachments: [SessionAttachment],
        to sessionID: String,
    ) throws {
        let paths = try attach(attachments, to: sessionID)
        try send(SessionTurn.text(text, attaching: paths), to: sessionID)
    }
}
