import Foundation

/// The rate a change to the join reaches the cockpit at.
///
/// Split from `TranscriptWatch.swift` for the reason `+Reading` and `+Sweeping` are — the class
/// body is capped, and a cap is met by putting a half of the type where it belongs rather than by
/// suppressing the gate.
@MainActor
extension TranscriptWatch {
    /// How often the join may publish. The whole window is re-derived off `joinRevision`: a launch
    /// against a week-wide record root opens 580 tails and wrote it 1,160 times, and a settled
    /// cockpit writes it once per batch at the rate the FSEvents sweep coalesces at (#1538).
    ///
    /// A tenth of a second is the honest ceiling: what is held back is a ROW MOVING, so 10 Hz is
    /// faster than a reader can follow and still under what anyone would call a lag.
    ///
    /// It bounds the RATE and never the wait — a change held is published when the window is up,
    /// by the task `hold` arms, whether or not anything else writes the join.
    static var publishWindow: TimeInterval {
        0.1
    }

    /// What follows a change that MOVED the join — see `TranscriptWatch.mutate`, which is the one
    /// caller and the one write.
    ///
    /// Leading edge, so a cockpit that has been quiet draws the next change at once and the rate
    /// only bites where changes are actually arriving faster than the window.
    func publishTheChange() {
        guard let waited = publishedAt.map({ Date().timeIntervalSince1970 - $0 }),
              waited < Self.publishWindow
        else { return publish() }
        hold(for: Self.publishWindow - waited)
    }

    /// Stop the publish waiting on the window. What a teardown does with it: the join it would
    /// have stamped is the one being emptied.
    func stopPublishing() {
        waitingPublish?.cancel()
        waitingPublish = nil
    }

    /// Publish once the window is up. Armed once and left standing: every change landing behind it
    /// is already in the join, so the one publish carries all of them.
    private func hold(for remaining: TimeInterval) {
        guard waitingPublish == nil else { return }
        waitingPublish = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(remaining))
            guard !Task.isCancelled else { return }
            self?.publish()
        }
    }

    private func publish() {
        stopPublishing()
        stampTheJoin()
        publishedAt = Date().timeIntervalSince1970
        onPublished()
    }
}
