import Foundation

/// What a Linear write has to look up before it can be sent.
///
/// Every mutation names its subject by UUID and its state, label and relation by id, where Argo
/// holds a number and a word. So a write costs a read to address — the same shape GitHub's edge
/// endpoints force, for the same reason.
extension LinearWorkItems {
    /// Linear's UUID for the number Argo holds.
    func identifier(of number: Int, through binding: ResolvedBinding) async throws -> String {
        guard let issue = try await found(number, through: binding) else {
            throw WorkItemWriteError.refused("Linear holds no issue \(number) in this team.")
        }
        return issue.id
    }

    /// The subject as Linear now holds it, in the writer's vocabulary.
    func found(_ number: Int, through binding: ResolvedBinding) async throws -> LinearIssue? {
        do {
            return try await issue(number, in: binding.binding.scope, grant: binding.grant)
        } catch {
            throw error.writeError
        }
    }

    /// The team's own column for a canonical state — by category, then by the team's own order.
    ///
    /// A team with both `Backlog` and `Todo` has two `todo` columns and the first is where work
    /// waits. A team that deleted its cancelled column genuinely cannot express `closed`, and that
    /// is `inexpressible` rather than a write into the nearest thing it does have.
    func stateID(
        for state: WorkItemCanonicalState, through binding: ResolvedBinding,
    ) async throws
        -> String {
        let columns = try await states(through: binding)
            .filter { $0.category.canonical == state }
            .sorted { $0.position < $1.position }
        guard let first = columns.first else {
            throw WorkItemWriteError.inexpressible(state)
        }
        return first.id
    }

    /// The id of an existing label. This adapter does not CREATE one: a label is a workspace-wide
    /// fact in Linear, and filing a new one to satisfy a write would leave a taxonomy nobody chose.
    func labelID(named name: String, through binding: ResolvedBinding) async throws -> String {
        let payload: LinearLabelList = try await read(
            LinearOperation(LinearDocuments.label, ["name": .string(name)]), through: binding,
        )
        guard let label = payload.issueLabels.nodes.first else {
            throw WorkItemWriteError.refused("This workspace has no label called \"\(name)\".")
        }
        return label.id
    }

    /// The relation to delete, which Linear addresses by its own id rather than by its two ends.
    func relationID(
        blocking number: Int, on id: String, through binding: ResolvedBinding,
    ) async throws
        -> String {
        let payload: LinearRelationList = try await read(
            LinearOperation(LinearDocuments.blockers, ["id": .string(id)]), through: binding,
        )
        let edge = payload.issue?.inverseRelations.nodes.first {
            $0.type == LinearWorkItems.blocks && $0.issue.number == number
        }
        guard let edge else {
            throw WorkItemWriteError.refused("Issue \(number) does not block this one.")
        }
        return edge.id
    }

    /// One read on the write path, whose failure is the writer's word rather than the ledger's.
    func read<Payload: Decodable>(
        _ operation: LinearOperation, through binding: ResolvedBinding,
    ) async throws
        -> Payload {
        do {
            return try await call.payload(operation, grant: binding.grant)
        } catch {
            throw error.writeError
        }
    }

    private func states(through binding: ResolvedBinding) async throws -> [LinearWorkflowState] {
        let payload: LinearTeamPayload<LinearStateList> = try await read(
            LinearOperation(
                LinearDocuments.teamStates, ["team": .string(binding.binding.scope)],
            ),
            through: binding,
        )
        guard let team = payload.team else {
            throw WorkItemWriteError.refused("This account cannot see the team.")
        }
        return team.states.nodes
    }
}
