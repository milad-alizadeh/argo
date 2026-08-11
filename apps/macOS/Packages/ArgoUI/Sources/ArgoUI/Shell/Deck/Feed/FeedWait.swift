/// Which wait the reading is showing, if any. Its IDENTITY rather than its age: an age is counted
/// from the moment this value CHANGES.
///
/// Read back off the rows rather than decided a second time — `FeedProjection` owns the split
/// between the thread and a lit row.
enum FeedWait: Equatable {
    /// The Turn is thinking, and the thread stands over the whole measure.
    case thinking
    /// The Turn is running this row's call, and the ion crosses its own type.
    case call(FeedRow.ID)

    /// What this reading is waiting on. A row appended while the wait runs does not change it, so a
    /// think that says something and goes on thinking stays one wait.
    static func showing(in rows: [FeedRow]) -> FeedWait? {
        if let lit = rows.first(where: { $0.content.isCallInFlight }) {
            return .call(lit.id)
        }
        return rows.contains { $0.content == .mark(.working) } ? .thinking : nil
    }
}
