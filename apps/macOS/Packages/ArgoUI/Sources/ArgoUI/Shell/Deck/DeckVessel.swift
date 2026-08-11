/// What is in the deck's one slot below the reading.
///
/// The slot is SINGULAR — one vessel, holding whichever question is live (design decision 6) — and
/// this is the type that says so. A composer beside a Permission prompt used to be a state five
/// files described in prose and one view body ruled out; here it is unrepresentable, and the rule
/// that decides between them is `resolve(for:canAttach:)`.
///
/// A pure value with no closures in it, on purpose: eight of the deck's nine call sites are
/// specimens and previews driving it with hand-built fixtures, and a vessel that could only be
/// built from a live Hub projection would mean fabricating a whole Hub to render one composer
/// state. What the controls DO travels beside it, in `DeckIntents`.
enum DeckVessel: Equatable {
    /// A Session Argo can put keystrokes to, with nothing blocking it.
    case composer(SessionComposerProjection.Composer)
    /// The Permission that Session is blocked on. It takes the composer's own slot.
    case prompt(PermissionPromptProjection.Prompt)
    /// Why there is no field at all (#546). Drawn as a ROW rather than a floating vessel — see
    /// `isFloating`.
    case unavailable(SessionComposerProjection.Unavailable)
    /// Nothing selected: the empty deck rather than a degraded one.
    case none

    /// The one resolution, in the one order that holds.
    ///
    /// Undriveable outranks everything: an Allow whose gate died with the PTY answers nothing, so
    /// a prompt there is exactly the affordance that cannot work. A pending Permission then
    /// outranks the field, because the vessel holds whichever question is live.
    static func resolve(
        for session: CockpitPresentation.Session?,
        canAttach: Bool,
    )
        -> DeckVessel {
        guard let session else { return .none }
        if let unavailable = SessionComposerProjection.unavailable(for: session) {
            return .unavailable(unavailable)
        }
        if let prompt = PermissionPromptProjection.prompt(for: session) {
            return .prompt(prompt)
        }
        return SessionComposerProjection
            .composer(for: session, canAttach: canAttach)
            .map(DeckVessel.composer) ?? .none
    }

    var composer: SessionComposerProjection.Composer? {
        guard case let .composer(composer) = self else { return nil }
        return composer
    }

    var prompt: PermissionPromptProjection.Prompt? {
        guard case let .prompt(prompt) = self else { return nil }
        return prompt
    }

    var unavailable: SessionComposerProjection.Unavailable? {
        guard case let .unavailable(unavailable) = self else { return nil }
        return unavailable
    }

    /// Whether something floats OVER the reading rather than replacing its end. What the feed's
    /// bottom clearance and the plan pill's lift are both read off.
    var isFloating: Bool {
        switch self {
        case .composer, .prompt: true
        case .unavailable, .none: false
        }
    }
}
