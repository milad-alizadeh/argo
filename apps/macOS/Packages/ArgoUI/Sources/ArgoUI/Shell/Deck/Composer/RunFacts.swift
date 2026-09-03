import ArgoEngine

/// What the Session RUNS AT, as the composer states it: the CLI's own two knobs, Model and Effort
/// (#558, design decision 2).
///
/// Deliberately not Mode. Mode is Argo's standing autonomy stance and sits on the footer beside
/// this, where it is read without opening anything — keeping the two apart is what stops the
/// composer implying that changing the model changes how often you are asked.
///
/// A derived value and not state: everything here is read back off the Session's own records, so
/// what the popover ticks and what the CLI is on cannot come apart. Nothing in it is normalised —
/// a model this Argo's table has never heard of states itself.
package struct RunFacts: Equatable {
    /// The model id the records report, verbatim and unread. `nil` where none has been read, which
    /// is `unknown` rather than a guess.
    package let model: String?
    /// The effort as Argo can place it — a rung, or the CLI's own word off the ladder.
    package let effort: SessionEffortReading
    /// Whether this Session's adapter can be put on a model at all (#761's rule for a new
    /// capability). `false` leaves the Model section OUT of the popover rather than drawing it
    /// greyed: a control that cannot work gives no reason for not working.
    package let choosesModel: Bool
    /// Whether it can be put on an effort level. Its own answer, because an adapter may expose one
    /// knob and not the other.
    package let choosesEffort: Bool

    package init(
        model: String?,
        effort: SessionEffortReading,
        choosesModel: Bool = false,
        choosesEffort: Bool = false,
    ) {
        self.model = model
        self.effort = effort
        self.choosesModel = choosesModel
        self.choosesEffort = choosesEffort
    }

    /// What a fact Argo could not establish reads as — the word itself, never a plausible value.
    package static let unknownWords = "unknown"

    /// The model, said the way a person says it. An id the table knows becomes its name; one it
    /// does not is stated VERBATIM, because the ids belong to the providers and a newer model is
    /// not an error (`ReadableModelName`).
    var modelWords: String {
        model.map(ReadableModelName.readable) ?? Self.unknownWords
    }

    /// The whole trigger: `Opus 5 · Medium`, in the deck header's own dim `·`-separated idiom.
    var words: String {
        "\(modelWords) · \(effort.words)"
    }

    /// Whether either knob can be reached at all. `false` leaves the facts as WORDS — a trigger
    /// that opened onto nothing would be a promise the footer cannot keep.
    var canOpen: Bool {
        choosesModel || choosesEffort
    }

    /// Whether both facts are where a fresh Session starts. The trigger is chromeless at the
    /// defaults and brightens off them, so the one thing it costs a reader to notice is the one
    /// thing worth noticing.
    ///
    /// An `unknown` on either side is NOT default: a fact Argo could not establish is exactly the
    /// one worth looking at, and drawing it quiet would hide it.
    var isDefault: Bool {
        modelWords == RunFactsModel.default.name && effort.rung == Self.defaultEffort
    }

    /// The rung a fresh Session starts on, and the one the reset names.
    static let defaultEffort = SessionEffort.medium

    /// The Model rows the popover offers: the short list, plus the Session's own reading where that
    /// reading is not on it.
    ///
    /// Appending rather than dropping is the whole of acceptance criterion 2 — a model Argo does
    /// not recognise renders as given. Without the extra row the tick would have nowhere to land,
    /// and a list with nothing ticked reads as a Session on no model at all.
    var models: [RunFactsModel] {
        let offered = RunFactsModel.offered
        guard let model, !offered.contains(where: { $0.name == modelWords }) else { return offered }
        return offered + [RunFactsModel(id: model, name: modelWords, note: "as the CLI reports it")]
    }

    /// The row to tick, and `nil` where a tick would be a lie — a Session whose records have named
    /// no model at all.
    var tickedModel: RunFactsModel? {
        guard model != nil else { return nil }
        return models.first { $0.name == modelWords }
    }

    /// What the reset RESTORES, named rather than called "default" — `Code · Opus 5 · Medium`. A
    /// reset that said "default" would make the reader open it to find out what that was.
    static func resetWords(mode: SessionMode) -> String {
        "Reset to \(mode.label) · \(RunFactsModel.default.name) · \(defaultEffort.label)"
    }
}

/// One row of the popover's Model list: what to ask the CLI for, what to call it, and the one-line
/// note the design sets beside it.
package struct RunFactsModel: Equatable, Hashable, Identifiable {
    /// What is TYPED at the CLI. An alias for the offered three, so a Session opened today lands on
    /// whatever the CLI currently calls the latest of that family — and the full id for a row that
    /// exists only because the Session was read on it.
    package let id: String
    /// The name a person uses. It is also the JOIN: a reading is ticked when
    /// `ReadableModelName.readable` of the id the records report equals this.
    package let name: String
    /// The trailing caption `run.png` draws — what picking this row is FOR, in three words.
    package let note: String

    /// The three the popover offers, in the design's own order. Three fit inline, which is the
    /// whole reason Model is a list and not a pop-up button: a pop-up's menu overflowed the
    /// popover's right edge and covered the Effort row, and nothing here opens on top of anything.
    ///
    /// A pure data catalog, staleable by construction the way `ReadableModelName` is: the aliases
    /// belong to the CLI, and a row whose alias it stops resolving is a row that stops working
    /// rather than one that silently picks something else.
    static let offered = [
        RunFactsModel(id: "opus", name: "Opus 5", note: "the default"),
        RunFactsModel(id: "sonnet", name: "Sonnet 5", note: "faster, cheaper"),
        RunFactsModel(id: "haiku", name: "Haiku 4.5", note: "quick edits"),
    ]

    /// The one the reset names, and the one `isDefault` is measured against.
    static var `default`: RunFactsModel {
        offered[0]
    }
}
