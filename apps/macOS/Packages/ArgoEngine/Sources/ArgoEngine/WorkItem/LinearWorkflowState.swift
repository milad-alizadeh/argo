import Foundation

/// One of Linear's workflow-state categories — the fixed set every team's own columns are built
/// out of, whatever a team named them.
///
/// The category is read and the NAME is not, because the name is per-team prose: two teams
/// spelling a `started` column "In Review" and "Doing" mean the same category, and reading the
/// canonical state off the word would make Argo's grouping depend on a team's typography. The
/// word itself still renders, verbatim, as the ticket's status (#272).
enum LinearWorkflowCategory: String, Equatable, Sendable, CaseIterable {
    case triage
    case backlog
    case unstarted
    case started
    case completed
    case canceled

    /// A category Argo does not recognise makes the quietest claim available: the work is not
    /// finished and has not started (`CONTEXT.md` L2 · degrade-down). Read here rather than by a
    /// `Decodable` conformance, which would fail the whole listing over one unknown word.
    init(reading text: String) {
        self = LinearWorkflowCategory(rawValue: text) ?? .unstarted
    }

    /// The canonical bucket this category falls in.
    ///
    /// `inReview` is deliberately unreachable: Linear has no review CATEGORY, so a team's "In
    /// Review" column is a `started` state and telling it apart would mean reading the name. A
    /// canonical `inReview` derived from prose is a false DIRECT (`CONTEXT.md` L2).
    var canonical: WorkItemCanonicalState {
        switch self {
        case .triage, .backlog, .unstarted: .todo
        case .started: .inProgress
        case .completed: .done
        case .canceled: .closed
        }
    }

    var closure: WorkItemClosure {
        switch self {
        case .triage, .backlog, .unstarted, .started: .open
        case .completed: .resolved
        case .canceled: .ruledOut
        }
    }
}

/// The state a listed issue is in: the team's own word for the column, and the category behind it.
struct LinearIssueState: Decodable {
    let name: String
    let type: String

    var category: LinearWorkflowCategory {
        LinearWorkflowCategory(reading: type)
    }
}

/// One column of a team's workflow, which is what a transition has to name by id.
struct LinearWorkflowState: Decodable {
    let id: String
    let name: String
    let type: String
    /// Where the column sits in the team's own order, which is what picks between two columns of
    /// one category — a team with `Backlog` and `Todo` has two, and the first is where work waits.
    let position: Double

    var category: LinearWorkflowCategory {
        LinearWorkflowCategory(reading: type)
    }
}
