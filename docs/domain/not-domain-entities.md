## Not domain entities

**Cockpit · Roster · Panels · rooms** — UI surfaces; they *render* the domain and are modeled at
design time. The **Hub** (main-process in-memory projection assembling the join —
ADR-0023/0017) and the **transcript-tailing parser** are runtime *mechanisms*.

**Fold** — a Roster grouping, and never an entity. One row standing for the `headless` Sessions
(L2 · Entry) that share a working directory, captioned with how many there are. It has no id
beyond that directory, the Hub has never heard of it, and nothing about a Session is stored on
it: it is something the Roster DOES to Sessions, decided once per pass in the projection.

Three rules keep it from lying. An `interactive` Session is never in one, whatever it sits beside.
A lone run is never folded — a fold of one saves no row and costs a name. And a fold is **opened**
rather than entered: selecting it draws its runs as ordinary rows underneath, because a fold is not
a Session and the deck can render nothing for it. That is what keeps a headless run that FAILED
reachable, which is the whole reason the Roster folds these rows instead of dropping them.
