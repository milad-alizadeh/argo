import Foundation

/// Linear as the write half of the Work Item port (#371, #257, #167).
///
/// **A workflow tracker**, which is the half of the port GitHub cannot stand for: `inProgress` is
/// a category Linear holds rather than a state approximated onto open-and-closed. `inReview` is
/// still not offered — Linear has no review CATEGORY, and reading one off a column's name would be
/// a canonical state derived from a team's typography (`LinearWorkflowCategory`).
extension LinearWorkItems: WorkItemWriting {
    public var surface: WorkItemSurface {
        WorkItemSurface(
            writes: Set(WorkItemWrite.allCases),
            states: [.todo, .inProgress, .done, .closed],
        )
    }

    public func create(
        _ draft: WorkItemDraft, through binding: ResolvedBinding,
    ) async throws
        -> WorkItem {
        var input: [String: LinearValue] = [
            "teamId": .string(binding.binding.scope), "title": .string(draft.title),
        ]
        if let body = draft.body {
            input["description"] = .string(body)
        }
        if let parent = draft.parent {
            // Named at file time, unlike GitHub's two acts: Linear takes the parent on the create,
            // so there is no window in which the ticket exists and is not yet a child.
            input["parentId"] = try await .string(identifier(of: parent, through: binding))
        }
        let filed = try await sent(
            LinearOperation(LinearDocuments.issueCreate, ["input": .object(input)]),
            through: binding,
        )
        guard let number = filed.issue?.number else {
            throw WorkItemWriteError.refused("Linear filed the ticket without saying its number.")
        }
        return try await adopted(number, through: binding)
    }

    public func apply(
        _ intent: WorkItemIntent, to number: Int, through binding: ResolvedBinding,
    ) async throws
        -> WorkItem {
        guard surface.offers(intent.write) else {
            throw WorkItemWriteError.unavailable(intent.write)
        }
        if case let .transitionTo(state) = intent, !surface.states.contains(state) {
            throw WorkItemWriteError.inexpressible(state)
        }
        let id = try await identifier(of: number, through: binding)
        _ = try await sent(
            operation(for: intent, on: id, through: binding), through: binding,
        )
        return try await adopted(number, through: binding)
    }

    /// One mutation, and Linear's own answer about whether it landed.
    ///
    /// `success` is read rather than assumed: a mutation that answered `false` did not apply, and
    /// adopting the ticket afterwards would report a write that never happened.
    private func sent(
        _ operation: LinearOperation, through binding: ResolvedBinding,
    ) async throws
        -> LinearMutation.Outcome {
        let reply: LinearMutation = try await read(operation, through: binding)
        guard reply.result.success else {
            throw WorkItemWriteError.refused("Linear did not apply the change.")
        }
        return reply.result
    }

    /// The ticket as the PROVIDER holds it afterwards, read back through the same fields a listing
    /// uses — so an adopted ticket and a listed one can never be told apart by what they carry.
    ///
    /// Read back rather than taken from the mutation's reply: Linear answers `issueUpdate` with
    /// the issue, but without the relations and children a listing carries, and adopting that
    /// would blank a ticket's edges every time anything was written to it.
    private func adopted(_ number: Int, through binding: ResolvedBinding) async throws -> WorkItem {
        guard let issue = try await found(number, through: binding) else {
            throw WorkItemWriteError.refused("Linear holds no issue \(number) in this team.")
        }
        return issue.workItem()
    }
}
