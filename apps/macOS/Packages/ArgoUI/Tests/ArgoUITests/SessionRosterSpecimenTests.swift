@testable import ArgoUI
import Testing

/// What the roster PNGs are evidence OF — asserted so a fixture that stopped reaching a rendering
/// fails here rather than silently narrowing the only evidence those renderings have.
@Suite("Session roster specimens")
struct SessionRosterSpecimenTests {
    @Test
    func `the roster the specimen renders reaches every row rendering`() {
        // The `sessionRows` PNG is the only evidence roster states have, and it draws exactly
        // these rows. A preview presentation that stopped mixing access, or lost a status,
        // would silently narrow that evidence rather than fail anything.
        let rows = SessionRosterProjection.previewRows

        #expect(Set(rows.map(\.state)) == [.running, .attention, .idle, .failure, nil])
        // The ghosted row is also the long one: whether a title still truncates cleanly once
        // the whole row is drawn quieter is the render question the PNG exists to settle, and
        // a short read-only title would leave it unrendered without failing anything.
        #expect(rows.contains { $0.isReadOnly && $0.title.count > 40 })
        // Both worktree renderings, for the same reason: a one-line row sitting between
        // two-line ones is a rhythm question, and a roster where every Session sat in its own
        // worktree would leave it unrendered.
        #expect(rows.contains { $0.worktree == nil })
        // A real ticket worktree, not a folder called `argo`: whether one truncates at the row's
        // width without losing the ticket it is named for is the other question the PNG settles.
        #expect(rows.contains { $0.worktree?.hasPrefix("ticket-") == true })
        // A long label beside an age, because whether the worktree truncates rather than pushing
        // the age off the line is a layout claim no value test can see.
        #expect(rows.contains { ($0.worktree?.count ?? 0) > 30 && $0.age != nil })
        // And a Session on a detached checkout, whose row is located without a branch to name.
        #expect(rows.contains { $0.branch == nil && $0.worktree != nil })
        // And a row with no age that is not simply the running one: the record-carried-no-time
        // rendering is the absence the roster has to draw, and the running row would satisfy a
        // bare `age == nil` on its own.
        #expect(rows.contains { $0.age == nil && $0.state != .running })
    }

    @Test
    func `the ghosted roster the specimen renders puts both accesses on one screen`() {
        // The `ghostedRows` PNG is the only evidence whole-row ghosting has, and it is a
        // COMPARISON: a list of nothing but read-only rows would look like a roster with a
        // dimmer palette, and prove nothing about the state.
        let rows = GhostedRosterSpecimen.rows

        #expect(rows.contains { $0.isReadOnly })
        #expect(rows.contains { !$0.isReadOnly })
        // Every element a row can draw has to appear ON a ghosted row, or the claim that the
        // row degrades as one is only rendered for the half of it that happened to be there.
        #expect(rows.contains { $0.isReadOnly && $0.stateWord != nil })
        #expect(rows.contains { $0.isReadOnly && $0.worktree != nil && $0.age != nil })
        // And the other rendering on a ghosted row too: a row with nothing on its second line
        // but an age is the shortest thing the roster draws, and ghosting has to reach it.
        #expect(rows.contains { $0.isReadOnly && $0.worktree == nil })
        // Including the loudest ink the roster has: a live dot on a Session nobody can steer.
        #expect(rows.contains { $0.isReadOnly && $0.state == .running })
    }
}
