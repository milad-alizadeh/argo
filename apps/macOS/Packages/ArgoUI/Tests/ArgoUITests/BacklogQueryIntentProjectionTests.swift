@testable import ArgoUI
import Testing

/// Judges `BacklogQueryIntentProjection` against `BacklogQueryIntentCorpus` — a ~100-query
/// stand-in for what a reader really types — on the two axes #1316 asks for: whether the FINAL
/// answer is right, and whether the answer holds still on the way there. The second axis is the
/// real bar (`docs/designs/cockpit-backlog-question.md`): a rule right at the end and wrong four
/// times mid-sentence gives a flickering glyph, which reads worse than no ask at all.
///
/// **#1316 returned FAIL on the design's proposed rule and the design was reopened.** #1317
/// replaced it rather than switching variants, so this file now carries two things: the numbers
/// the shipped rule scores, and — in `Superseded` below — the numbers that failed, still runnable
/// against `BacklogQueryIntentSupersededRule`. Both sets are PINNED, so a future change to the
/// rule has to touch this file and re-argue against a measured predecessor rather than against a
/// remembered one.
@Suite("Backlog query intent projection")
struct BacklogQueryIntentProjectionTests {
    // MARK: - Accuracy, on the final text

    /// The corpus size #1316 asks for — its own test, so a corpus that shrinks under editing
    /// fails loudly rather than quietly weakening every count pinned below.
    @Test
    func `the corpus holds about a hundred queries`() {
        #expect(BacklogQueryIntentCorpus.entries.count == 106)
    }

    /// The design's first named risk — "a long term reads as a question" — is what the six-word
    /// floor caused and what dropping length cured. Three survive, and they are named rather than
    /// counted because each one is a decision somebody should be able to argue with:
    ///
    /// - the two `titleShapedNoMark` fragments open on a real interrogative and the corpus calls
    ///   them terms anyway. Nothing in the text separates them from `why blocked`; the corpus
    ///   picked a side and the rule pays two entries for it.
    /// - the pasted quote carries a `?` terminating words, inside quotation marks. Reading the
    ///   quotes would separate it, and would then read every unbalanced quote a reader typed.
    @Test
    func `only three terms are misread as questions, and they are these three`() {
        let falsePositives = BacklogQueryIntentCorpus.entries.filter {
            $0.expected == .term && BacklogQueryIntentProjection.kind(of: $0.query) == .question
        }

        #expect(
            Set(falsePositives.map(\.query)) == [
                "what happened here",
                "is this ticket closed",
                "renamed \"what happened to the ordering menu?\" to a clearer title",
            ],
            "\(falsePositives.map(\.query))",
        )
    }

    /// Not one pasted title or long noun phrase is misread any more — the group that supplied
    /// most of the superseded rule's 19, and the group a backlog's reader types most. Its own
    /// test, because it is the whole reason length left the rule.
    @Test
    func `no pasted title or long term reads as a question`() {
        let longTerms = BacklogQueryIntentCorpus.entries.filter {
            $0.group == "pasted title" || $0.group == "awkward: long term"
        }

        #expect(longTerms.count == 17)
        for entry in longTerms {
            #expect(
                BacklogQueryIntentProjection.kind(of: entry.query) == .term,
                "read as a question: \(entry.query)",
            )
        }
    }

    /// The design's second named risk — "a short question reads as a term" — is the feature never
    /// appearing. One survives: `still open` opens on an adverb and carries no mark, so there is
    /// nothing in it to read. `why blocked`, the other half of the pair the superseded rule
    /// missed, is now caught by its opener.
    @Test
    func `only a question with neither an opener nor a mark is missed`() {
        let questions = BacklogQueryIntentCorpus.entries.filter { $0.expected == .question }
        let falseNegatives = questions.filter {
            BacklogQueryIntentProjection.kind(of: $0.query) == .term
        }

        #expect(
            Set(falseNegatives.map(\.query)) == ["still open"],
            "\(falseNegatives.map(\.query))",
        )
    }

    /// A URL's `?` is not a question mark, and this is the clause that says so: the mark has to
    /// terminate two words. Their own test because they were the corpus's only double-flippers.
    @Test
    func `a url query string is not a question`() {
        let urls = BacklogQueryIntentCorpus.entries.filter { $0.group == "awkward: url query" }

        #expect(urls.count == 3)
        for entry in urls {
            #expect(
                BacklogQueryIntentProjection.kind(of: entry.query) == .term,
                "read as a question: \(entry.query)",
            )
        }
    }

    // MARK: - Stability, over every prefix

    /// **The bar #1316 failed the old rule on, now met by construction.** Both of the shipped
    /// rule's clauses are monotone over prefixes — an opener is fixed once its word is finished,
    /// and a mark that has been typed stays typed — so the answer can go `.term → .question` and
    /// never back. This asserts it over every prefix of every query rather than counting how often
    /// it happens to hold: a count would let a regression trade one query's flicker for another's.
    @Test
    func `the glyph never changes its mind more than once, on any query`() {
        for entry in BacklogQueryIntentCorpus.entries {
            #expect(
                BacklogQueryIntentProjection.flips(typing: entry.query) <= 1,
                "\(entry.query) flips \(BacklogQueryIntentProjection.flips(typing: entry.query))×",
            )
        }
    }

    /// The same property stated the other way, which is what actually rules out a retraction: no
    /// prefix reads `.question` while a LONGER one reads `.term`. The flip count above would be
    /// satisfied by a rule that only ever went question-to-term, and that rule would put the wand
    /// up and take it away again.
    @Test
    func `no prefix loses the question a shorter one found`() {
        for entry in BacklogQueryIntentCorpus.entries {
            let kinds = BacklogQueryIntentProjection.prefixes(of: entry.query)
                .map(BacklogQueryIntentProjection.kind(of:))
            guard let found = kinds.firstIndex(of: .question) else { continue }

            #expect(
                kinds[found...].allSatisfy { $0 == .question },
                "the wand retracts while typing: \(entry.query)",
            )
        }
    }

    /// Not one query in the corpus flips twice — the failure that named variant B as the fallback.
    /// Implied by the two tests above and pinned anyway, because it is the number on #1316's
    /// verdict and the one a reader of that issue will come here to check.
    @Test
    func `nothing in the corpus flips the glyph twice`() {
        let multiFlipping = BacklogQueryIntentCorpus.entries
            .filter { BacklogQueryIntentProjection.flips(typing: $0.query) > 1 }

        #expect(multiFlipping.isEmpty, "\(multiFlipping.map(\.query))")
    }

    /// The other half of the comparison table in `docs/designs/cockpit-backlog-question.md`: how
    /// many queries raise the wand at all. Every one of them does it exactly once — this is the
    /// count the design quotes against the superseded rule's 51, and it is pinned here so the two
    /// numbers in that table cannot drift apart from the rule they describe.
    @Test
    func `thirty-three queries raise the wand, each exactly once`() {
        let raising = BacklogQueryIntentCorpus.entries
            .filter { BacklogQueryIntentProjection.flips(typing: $0.query) == 1 }

        #expect(raising.count == 33)
        // Raising it once and reading `.term` at the end would mean it came back down.
        #expect(raising.allSatisfy { BacklogQueryIntentProjection.kind(of: $0.query) == .question })
    }

    // MARK: - What was superseded

    /// #1316's measurements, still runnable. Every number here is what
    /// `docs/designs/cockpit-backlog-question.md` proposed and what the design's reopening banner
    /// quotes; keeping them executable is what stops the banner from becoming folklore.
    @Suite("The rule the design proposed, and #1316 failed")
    struct Superseded {
        /// "A long term reads as a question" — one term in six.
        @Test
        func `nineteen terms read as questions`() {
            let falsePositives = BacklogQueryIntentCorpus.entries.filter {
                $0.expected == .term
                    && BacklogQueryIntentSupersededRule.kind(of: $0.query) == .question
            }

            #expect(falsePositives.count == 19)
        }

        /// "A short question reads as a term" — the pair with no mark and under six words.
        @Test
        func `two questions are missed outright`() {
            let falseNegatives = BacklogQueryIntentCorpus.entries.filter {
                $0.expected == .question
                    && BacklogQueryIntentSupersededRule.kind(of: $0.query) == .term
            }

            #expect(Set(falseNegatives.map(\.query)) == ["why blocked", "still open"])
        }

        /// The stability failure itself, and the one the verdict rested on.
        @Test
        func `the glyph changes its mind on half the corpus, twice on three of it`() {
            let flips = BacklogQueryIntentCorpus.entries
                .map { BacklogQueryIntentSupersededRule.flips(typing: $0.query) }

            #expect(flips.count { $0 > 0 } == 51)
            #expect(flips.count { $0 > 1 } == 3)
        }
    }
}
