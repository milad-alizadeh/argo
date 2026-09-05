import ArgoEngine
@testable import ArgoUI
import Testing

/// The truth table `PlanBar` draws from — a step's status folded with whether the bar has
/// stopped moving (`cockpit-roster-row.md`, rule 3).
@Suite("PlanBar's fill")
struct PlanBarFillTests {
    @Test(arguments: [true, false])
    func `a completed step is always done`(isStill: Bool) {
        #expect(PlanBarFill.reading(status: .completed, isStill: isStill) == .done)
    }

    @Test
    func `the step in progress draws brightest while the Session is running`() {
        #expect(PlanBarFill.reading(status: .inProgress, isStill: false) == .doing)
    }

    @Test
    func `the step in progress when the Session stops is not one the reader can act on`() {
        // Not "got" any more than one still pending — it reads exactly the same.
        #expect(PlanBarFill.reading(status: .inProgress, isStill: true) == .pending)
    }

    @Test(arguments: [true, false])
    func `a pending step is always pending`(isStill: Bool) {
        #expect(PlanBarFill.reading(status: .pending, isStill: isStill) == .pending)
    }

    /// `.doing` is the only reading that breathes (`cockpit-roster-row.md`, rule 8 as amended by
    /// #1403), so this is what stops a stopped Session's bar from moving: there is no status it
    /// can hold that reads `.doing` once the bar is still.
    @Test(arguments: [PlanEntryStatus.completed, .inProgress, .pending])
    func `a still bar has no step that moves`(status: PlanEntryStatus) {
        #expect(PlanBarFill.reading(status: status, isStill: true) != .doing)
    }
}
