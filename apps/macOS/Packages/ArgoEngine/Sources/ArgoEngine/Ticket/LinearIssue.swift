import Foundation

/// One issue as Linear's GraphQL API serves it, parsed at the boundary and nowhere else.
///
/// Every edge arrives with the issue rather than behind a second request: Linear serves children
/// and relations as connections on the issue itself, which is why this adapter reads a whole
/// listing in one operation where GitHub's costs two per ticket.
struct LinearIssue: Decodable {
    /// Linear's UUID, which is NOT the number a human reads. Carried because every mutation and
    /// every relation names an issue by this and never by the number.
    let id: String
    /// The team-scoped number, which is the only part of a Linear issue Argo stores (`CONTEXT.md`
    /// L1 · Ticket).
    let number: Int
    let title: String
    /// Linear's Markdown body. Absent and blank are one state, since neither renders.
    let description: String?
    /// Linear's own priority word — `Urgent`, `High`, `Medium`, `Low`, or `No priority` for a
    /// ticket nobody ranked. Held verbatim and recased by nothing.
    let priorityLabel: String?
    let updatedAt: String?
    let state: LinearIssueState
    let assignee: Assignee?
    let labels: LinearNodes<Label>
    let children: LinearNodes<Child>
    /// The relations pointing AT this issue. A relation reads `issue blocks relatedIssue`, so the
    /// ones where this issue is the far end are the ones that block it.
    let inverseRelations: LinearNodes<Relation>

    struct Assignee: Decodable { let displayName: String }

    /// `color` is `#rrggbb` as Linear spells it.
    struct Label: Decodable {
        let name: String
        let color: String?
    }

    struct Child: Decodable { let number: Int }

    struct Relation: Decodable {
        /// `blocks`, `duplicate`, `related` or `similar` — only the first is an edge Argo reads.
        let type: String
        /// The issue at the OTHER end, which on an inverse relation is the one doing the blocking.
        let issue: Related

        struct Related: Decodable {
            let number: Int
            let state: LinearIssueState
        }
    }
}
