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

    /// The Turn half of a steer: the pause an `ESC` needs before the prompt will hear anything,
    /// then the Turn (#1238).
    ///
    /// The interrupt itself is deliberately NOT here. It is the half whose outcome decides what
    /// the composer does next — whether a boundary was claimed, whether the chip may say it is
    /// sending — and a caller cannot read that out of one throw covering both. So the caller takes
    /// the interrupt, synchronously, and hands what follows to this.
    ///
    /// What IS here is the pause, beside the keystrokes it paces rather than in a view counting
    /// milliseconds — the reason `ClaudeTurn.gap` lives where it does.
    func steer(
        _ text: String,
        attaching attachments: [SessionAttachment],
        to sessionID: String,
    ) async throws {
        try await Task.sleep(for: SessionSteer.gap)
        try send(text, attaching: attachments, to: sessionID)
    }
}
