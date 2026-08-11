/// The running list a host that writes its plan ONE ENTRY AT A TIME implies.
///
/// Claude Code writes `TaskCreate`/`TaskUpdate`: one entry at a time, addressed by an id only the
/// create's own RESULT reports. The list exists nowhere in the record; it is the fold of every
/// write before it.
///
/// It answers each write with the WHOLE list, which keeps ADR-0020 true downstream: the newest plan
/// is still the whole of it.
struct PlanLedger {
    /// One entry, plus the two names it answers to: `callID` is Argo's own id for the call that
    /// wrote it, and `taskID` is the host's, which is what an update addresses. The host's is
    /// absent between a create and its result, and stays absent for a create nothing answered —
    /// that entry is on the list and nothing can move it.
    private struct Entry {
        let callID: String
        let text: String
        var taskID: String?
        var status: PlanEntryStatus
    }

    private var entries: [Entry] = []

    /// One call → the whole list as it stands after it, or `nil` for a call that wrote nothing to
    /// it. A tool this does not name — `TaskStop`, which belongs to a background agent task and not
    /// to this list — falls through to `nil` and stays whatever news it already was.
    mutating func written(by use: ToolUseBlock) -> Plan? {
        switch use.name {
        case taskCreateTool: created(by: use)
        case taskUpdateTool: updated(by: use)
        default: nil
        }
    }

    /// The id a create's result reported, joined onto the entry that create made — the only place
    /// an id is ever written. A result quoting a call this ledger never made is left alone.
    mutating func identify(call callID: String, from toolUseResult: JSONValue?) {
        guard let id = toolUseResult?[taskResultKey]?.stringField(taskResultIDKey),
              let index = entries.firstIndex(where: { $0.callID == callID }) else { return }
        entries[index].taskID = id
    }

    /// An entry with no subject is dropped rather than shown blank.
    private mutating func created(by use: ToolUseBlock) -> Plan? {
        guard let text = use.input.stringField(taskSubjectKey) else { return nil }
        entries.append(Entry(callID: use.id, text: text, taskID: nil, status: .pending))
        return plan()
    }

    /// A rewording is not a status, and the entry it names keeps the one it has. An update naming a
    /// task the record never created moves nothing and reports nothing.
    private mutating func updated(by use: ToolUseBlock) -> Plan? {
        guard let status = writtenPlanEntryStatus(use.input.stringField(taskStatusKey)),
              let named = use.input.stringField(taskIDKey),
              let index = entries.firstIndex(where: { $0.taskID == named }) else { return nil }
        entries[index].status = status
        return plan()
    }

    private func plan() -> Plan {
        Plan(entries: entries.map { PlanEntry(text: $0.text, status: $0.status) })
    }
}
