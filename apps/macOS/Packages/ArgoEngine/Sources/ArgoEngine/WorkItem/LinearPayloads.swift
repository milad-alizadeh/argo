import Foundation

/// The shapes Linear's answers are decoded into.
///
/// `team` is optional on every one of them and that is the distinction being read: a null team is
/// Linear saying this identity cannot see it, which is the same answer `LinearScopeCheck` reads at
/// bind time.
struct LinearTeamPayload<Held: Decodable>: Decodable {
    let team: Held?
}

/// A paged connection: the nodes, and where the page got to.
struct LinearPage<Node: Decodable>: Decodable {
    let pageInfo: LinearPageInfo
    let nodes: [Node]
}

struct LinearIssuePage: Decodable {
    let issues: LinearPage<LinearIssue>
}

struct LinearIssueList: Decodable {
    let issues: LinearNodes<LinearIssue>
}

struct LinearTitleList: Decodable {
    let issues: LinearNodes<Titled>

    struct Titled: Decodable {
        let title: String
    }
}

struct LinearStateList: Decodable {
    let states: LinearNodes<LinearWorkflowState>
}

struct LinearLabelList: Decodable {
    let issueLabels: LinearNodes<Named>

    struct Named: Decodable {
        let id: String
    }
}

/// The relations pointing at one issue, with the id a delete has to name.
struct LinearRelationList: Decodable {
    let issue: Held?

    struct Held: Decodable {
        let inverseRelations: LinearNodes<Edge>
    }

    struct Edge: Decodable {
        let id: String
        let type: String
        let issue: Far

        struct Far: Decodable {
            let number: Int
        }
    }
}

/// Every mutation's answer, read through the `result` alias each document gives its field.
///
/// `success` is Linear's own flag and is read rather than assumed: a mutation that answered
/// `false` did not apply, and adopting the ticket afterwards would report a write that did not
/// happen.
struct LinearMutation: Decodable {
    let result: Outcome

    struct Outcome: Decodable {
        let success: Bool
        /// Present only on a create, which is the one mutation whose answer names a new ticket.
        let issue: Filed?

        struct Filed: Decodable {
            let number: Int
        }
    }
}
