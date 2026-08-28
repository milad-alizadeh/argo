import Foundation

/// The five things a Gantt layout has to get right (#903, #904, #905).
extension MermaidSpecimen {
    /// A multi-section chart across a quarter, in both of the absolute task forms and carrying
    /// ids: the hues have to separate the sections, and the dates over the bars have to stay off
    /// one another.
    nonisolated static let gantt = """
    How the mermaid epic actually ran:

    ```mermaid
    gantt
      title The mermaid epic, quarter by quarter
      dateFormat YYYY-MM-DD
      axisFormat %b %d
      section Reading
        The flowchart reader :flow, 2026-01-05, 3w
        The sequence reader  :seq, 2026-01-26, 2w
        The pie and quadrant :pie, 2026-02-09, 12d
      section Drawing
        The layered pass     :lay, 2026-01-19, 2026-02-16
        The time axis        :axis, 2026-02-21, 2w
      section Landing
        Review and rebase    :rev, 2026-03-07, 10d
        The epic closes      :close, 2026-03-17, 5d
    ```
    """

    /// One working day, hour by hour — where a tick step fixed at a day would draw one mark and
    /// call it an axis.
    nonisolated static let ganttDay = """
    One day of it, hour by hour:

    ```mermaid
    gantt
      title A day on the axis ticket
      dateFormat YYYY-MM-DD HH:mm
      axisFormat %H:%M
      section Morning
        Read the ticket  : 2026-02-21 09:00, 2026-02-21 10:30
        Write the reader : 2026-02-21 10:30, 3h
      section Afternoon
        The tick walk    : 2026-02-21 14:00, 4h
        Render and look  : 2026-02-21 18:00, 1h
    ```
    """

    /// A decade, where a tick a day would be a smear: the same source, marked at a step that fits.
    nonisolated static let ganttYears = """
    And the long view:

    ```mermaid
    gantt
      title A decade of it
      dateFormat YYYY-MM-DD
      axisFormat %Y
      section The long run
        The first attempt : 2016-01-01, 2019-06-30
        The rewrite       : 2019-07-01, 2023-12-31
        The one that shipped : 2024-01-01, 2026-06-30
    ```
    """

    /// A chain and a week of weekends (#904): every task but the first is placed by the one above
    /// it, the bars break around the days off, and `The bars` was told to start on a Saturday.
    nonisolated static let ganttChain = """
    And how it would run with the weekends off:

    ```mermaid
    gantt
      title The epic, weekends off
      dateFormat YYYY-MM-DD
      axisFormat %b %d
      excludes weekends
      section Reading
        The reader :read, 2026-01-01, 5d
        The dates  :dates, after read, 3d
      section Drawing
        The axis   :axis, after dates, 4d
        The bars   :bars, after axis, 2d
      section Landing
        Review     :rev, after bars, 3d
    ```
    """

    /// Every state a bar can carry, six of them in ONE section so the only thing varying is what
    /// the source said — which is the whole question #905 is about: done, plain and active have to
    /// read as one hue at three strengths, and `crit` as a ring rather than a fourth colour.
    ///
    /// It then runs out to SEVEN sections, which is not padding: the ring is the accent, and the
    /// hue it has least room against is series7 — the run's nearest neighbour to it. A criterion
    /// asserted on the two easiest hues is not asserted.
    nonisolated static let ganttStates = """
    What a bar says, as against where it sits:

    ```mermaid
    gantt
      title Four things a bar can say
      dateFormat YYYY-MM-DD
      axisFormat %b %d
      section One hue, every state
        Shipped last month   :done, a1, 2026-01-05, 2w
        An ordinary task     :a2, 2026-01-19, 2w
        Running right now    :active, a3, 2026-02-02, 12d
        On the critical path :crit, a4, 2026-02-14, 3w
        Critical and running :crit, active, a5, 2026-02-23, 10d
        The epic closes      :milestone, a6, 2026-03-07, 0d
      section And a second, olive
        Still its own colour :active, b1, 2026-01-12, 3w
        Shipped over there   :done, b2, 2026-02-02, 2w
        A ring on olive      :crit, active, b3, 2026-02-16, 2w
      section A third, pale blue
        A ring on pale blue  :crit, c1, 2026-01-19, 3w
        And its own marker   :crit, milestone, c2, 2026-02-16, 0d
      section Four
        Filling out the run  :d1, 2026-01-05, 2w
      section Five
        Filling out the run  :e1, 2026-01-19, 2w
      section Six
        Filling out the run  :f1, 2026-02-02, 2w
      section Seven, nearest the accent
        A ring on series7    :crit, active, g1, 2026-02-09, 3w
        And a spent one      :done, crit, g2, 2026-03-02, 1w
    ```
    """

    /// A state and a day off in one chart (#904 under #905): both bars break around the weekends,
    /// and every stretch has to carry what the whole task says. A first run drawn spent and the
    /// rest ordinary would say the work restarted on the Monday.
    nonisolated static let ganttStatesOff = """
    And with the weekends off, a broken bar still says one thing:

    ```mermaid
    gantt
      title One task, several runs, one state
      dateFormat YYYY-MM-DD
      axisFormat %b %d
      excludes weekends
      section Broken around the days off
        Shipped, in three runs :done, o1, 2026-01-01, 8d
        Ordinary, in three     :o2, 2026-01-01, 8d
        Critical and running   :crit, active, o3, 2026-01-01, 8d
    ```
    """
}
