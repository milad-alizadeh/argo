import ArgoEngine

/// A catalog for the `/` menu's renders, taken from what the study actually found on one machine
/// (`cockpit-composer-picker.md`, "What the study exposed"): skills from three origins, one with no
/// `description:` at all, and one name the Project and the user both carry.
///
/// Real rather than invented, because two of the design's decisions were drawn against exactly
/// these: the missing description (decision 5) and the collision (decision 7). A tidy fixture would
/// have had neither in it, and the two states nobody could have rendered are the two the menu is
/// most likely to get wrong.
enum CommandCatalogFixture {
    static let machine: [Skill] = project + user + plugin

    private static let project: [Skill] = [
        Skill(
            name: "ask-argo",
            description: "Router for Argo's own skills, and for the design route ask-matt has no "
                + "stage for. Use when the next step is unclear.",
            origin: .project,
        ),
        Skill(
            name: "code-review",
            description: "Review the changes since a fixed point (commit, branch, tag, or "
                + "merge-base) along two axes — Standards and Spec. Runs both in parallel.",
            origin: .project,
        ),
        Skill(
            name: "design-to-code",
            description: "Build a screen from an approved design — assembled from existing "
                + "primitives, components extracted only on evidence. Once per ticket.",
            origin: .project,
        ),
        Skill(
            name: "diagnosing-bugs",
            description: "Diagnosis loop for hard bugs and performance regressions.",
            origin: .project,
        ),
        Skill(
            name: "implement",
            description: "Implement a piece of work based on a spec or set of tickets.",
            origin: .project,
        ),
        // The collision: the user carries a `find-skills` too, and the CLI would never run it.
        Skill(
            name: "find-skills",
            description: "Helps users discover and install agent skills when they ask questions "
                + "like \"how do I do X\" or express interest in extending capabilities.",
            origin: .project,
            shadowsUser: true,
        ),
        // The one skill in the repo that genuinely states no description.
        Skill(name: "writing-great-skills", description: nil, origin: .project, shadowsUser: true),
    ]

    private static let user: [Skill] = [
        Skill(
            name: "ux-writing",
            description: "Write or review interface copy (microcopy) — buttons, labels, error "
                + "messages, notifications, forms, onboarding, empty states, help text.",
            origin: .user,
        ),
        Skill(
            name: "research",
            description: "Investigate a question against high-trust primary sources.",
            origin: .user,
        ),
    ]

    private static let plugin: [Skill] = [
        Skill(
            name: "simplify",
            description: "Review the changed code for reuse, simplification, efficiency, and "
                + "altitude cleanups, then apply the fixes.",
            origin: .plugin("argo"),
        ),
        Skill(
            name: "dataviz",
            description: "Use this skill whenever you are about to create any chart, graph, plot, "
                + "dashboard, or data visualization, in any output medium.",
            origin: .plugin("argo"),
        ),
    ]
}
