import Foundation

/// Tells a genuine departure from the window apart from a transient `controlActiveState` blip —
/// system UI briefly taking key (Spotlight, Mission Control, a notification banner) or any other
/// spurious flip macOS can report without the reader actually leaving. `ShellSidebar` used to
/// release the roster's hold on every raw `.inactive` signal, which let a Session's activity move
/// a row nobody had actually stopped reading (#1402).
///
/// Only an `.inactive` signal that survives `grace` unanswered by a return to `.active` is
/// trusted. The wait is injected (`elapse`) rather than a bare `Task.sleep`, the shape
/// `PermissionPatience` uses (`Drive/PermissionPatience.swift`), so the decision can be asserted
/// without a test actually sleeping.
struct RosterDisengagement: Sendable {
    /// How long an `.inactive` spell must go unanswered before it counts as the reader leaving.
    /// Long enough to clear the blips above; short enough that a genuine switch away still
    /// re-settles the roster promptly once the reader is back to look.
    let grace: Duration
    private let elapse: @Sendable (Duration) async -> Void

    init(grace: Duration = .milliseconds(600)) {
        self.init(grace: grace, elapse: { try? await Task.sleep(for: $0) })
    }

    init(grace: Duration, elapse: @escaping @Sendable (Duration) async -> Void) {
        self.grace = grace
        self.elapse = elapse
    }

    /// Waits out the grace period, then asks `isStillInactive` — read AFTER the wait, never
    /// before — whether the departure should still be believed. Calls `onDeparture` only then: a
    /// return to `.active` during the wait makes `isStillInactive` false and this a no-op.
    ///
    /// Both closures are `@MainActor`, not merely `@Sendable`: `ShellSidebar` closes them over
    /// `@State` it can only touch from the main actor, and a plain `@Sendable` closure cannot
    /// promise that.
    @MainActor
    func confirm(
        isStillInactive: @MainActor @Sendable () -> Bool,
        onDeparture: @MainActor @Sendable () -> Void,
    ) async {
        await elapse(grace)
        guard isStillInactive() else { return }
        onDeparture()
    }
}
