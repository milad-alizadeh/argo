extension CockpitPresentation.Session {
    /// What gets said across a long session, as the prose a real one is made of.
    ///
    /// A table rather than a template, and that is the whole point of it. A generated fixture
    /// repeating one sentence forty times is a wall at one width and one length — every paragraph
    /// wraps the same way, every turn takes the same height, and a render of it says nothing about
    /// whether a feed of REAL prose has a rhythm. What varies here is what varies in a session:
    /// how much was said, and whether anything was said at all.
    ///
    /// Long enough to wrap several times, short enough to be one word, and everything between.
    enum LongProse {
        static let prompts = [
            "Take the qualifier pass and make it stop being quadratic.",
            "Why is the feed slow?",
            "Land it.",
            "Read the anatomy study first, then tell me whether the measure still holds with the "
                + "panel open at the narrowest deck the window allows.",
            "Now do the same for the survey fold.",
            "Is that measured or is that a guess?",
            "Ship it, then open a follow-up for the bit you left.",
            "Hold on — what happens when the record is truncated mid-write?",
        ]

        static let thoughts = [
            "Read what is there before changing any of it.",
            "The pass runs once per row and scans every other row. That is the shape of it.",
            "Two same-named files in one feed is the case that makes the qualifier appear at all, "
                + "so the fixture needs both of them or the rule is never exercised.",
            "Measure before and after on the same transcript, or the number means nothing.",
            "A fold that reached across a mutation would be the feed lying about what happened.",
        ]

        /// Deliberately ragged: a one-word answer, a sentence, and a paragraph that has to wrap.
        static let messages = [
            "Done.",
            "It was the qualifier pass — every path asked every other path whether it had to be "
                + "told apart from it. Indexed by leaf name now: 548ms to 4.4ms on a real "
                + "5,428-line transcript.",
            "Green.",
            "Measured, not guessed. 6,511 events into 1,031 rows in 18ms, against the longest "
                + "transcript on this machine.",
            "The fold breaks at every mutation and every failure, so a run of reads can never "
                + "swallow the one row worth seeing. That is structural rather than a rule "
                + "somebody has to remember — the break is what the fold is made of.",
            "That one is a follow-up. A lazy stack's height is an estimate until its rows are "
                + "realised, so anchoring to the bottom on open lands near the end rather than at "
                + "it, and every measure taken off that estimate disagrees with what is on screen.",
            "Still red — the survey counts rows where it should count calls.",
            "Fixed.",
        ]
    }
}
