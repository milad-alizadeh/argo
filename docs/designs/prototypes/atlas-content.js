/* ============================================================================
   THE ATLAS CONTENT — hand-written for Argo itself, #650.

   Every path and line number is real. They were read out of apps/macOS on 2026-09-01. The
   prose is what a model must produce. It is a Claim like any other, and it is the thing this
   prototype exists to be judged on.

   The prose obeys Simplified Technical English: descriptive text, one new fact per sentence,
   25 words per sentence, one topic per paragraph, active voice, no semicolons.

   Node shape follows #647. A node holds what is inside it, the edges among those things, the
   edges that leave it, and a paragraph over all of that. There are two prose lengths and one
   control for the whole card. `stale` names which Claims are stale. Nothing shows provenance.
   ========================================================================== */

const A = {}; // id → node

/* ---------------------------------------------------------------- PROJECT -- */
A.argo = {
  kind: 'area', altitude: 'Project', name: 'Argo',
  line: 'A macOS cockpit that watches coding agents work, and steers the ones it started.',
  short: [
    `Argo watches coding agents work. A CLI leaves a record on disk. Argo reads that record,
     folds every transcript of one repository into one live picture, and shows it as a cockpit.
     Nine domains do the work.`,
    `Three domains only read. They find the files, turn lines into typed events, and join those
     events per Session. Two domains write. They send a Turn to a running agent, and they answer
     the permission that the agent asks for.`,
    `Two domains reach outside Argo, to the code host and the ticket provider. One domain holds
     the small set of facts that Argo owns. One domain is a seam. It is the only file that can
     read live state, so every view below it takes a value.`,
    `One rule crosses all nine. Every shown fact carries how Argo knows it. When a fact is
     ambiguous, Argo takes the lower rung. So Argo never claims something that it only guessed.`,
  ],
  long: [
    `Argo watches coding agents work. A CLI leaves a record on disk. Argo reads that record,
     folds every transcript of one repository into one live picture, and shows it as a cockpit.
     Nine domains do the work.`,
    `Three domains only read. <b>Finding the sessions</b> decides which files on this machine
     belong to this Project. <b>Reading the record</b> turns one growing JSONL file into typed
     events. <b>The join</b> folds those events into one Session per resume-chain. Everything
     else hangs off that spine.`,
    `Two domains write. <b>Driving a session</b> is what Argo does <i>to</i> an agent. It sends a
     Turn, interrupts, answers a permission, and walks the Mode ladder. <b>The companion
     channel</b> is one Unix socket per managed Session. It is the only place where a fact
     arrives that no transcript carries.`,
    `Two domains reach outside. <b>Accounts, tickets and delivery</b> talks to GitHub and Linear
     over HTTP. The join knows nothing about any of it, because those facts travel beside the
     projection. <b>What Argo owns</b> is the opposite corner. It holds a few small files that
     record what Argo asserts.`,
    `Two domains are structure. <b>The cockpit projection</b> is one file, and it is the only
     file in the view layer that can read live state. It restates a Session as a plain value.
     <b>The feed and the roster</b> are the two reading surfaces built from that value.`,
    `A shell script fails the build when another view reaches past the seam. The layering is a
     gate, not a review note.`,
    `The code is Swift, in three layers. The engine links no UI framework and runs from the
     command line. The view package takes values. The app target is small enough to check by
     line count. Read the domains in the order below. Each one makes the next one clear.`,
  ],
  inside: ['find', 'read', 'join', 'project', 'surfaces', 'drive', 'companion', 'ports', 'owned'],
  among: [
    `The first five domains are a pipeline. They read best in this order: files, then events,
     then the join, then the seam, then the surfaces.`,
    `<b>Driving a session</b> and <b>the companion channel</b> attach to the join from the side.
     Both publish their facts into the same ledger that the join folds. So neither one goes
     through the pipeline.`,
    `<b>Accounts, tickets and delivery</b> touches the join at one point only. It joins on a
     branch name, not on a Session id. <b>What Argo owns</b> goes into all the others as file
     URLs, and each URL is named in one place.`,
  ],
  leaving: [
    `A Project is the scope of one window. Nothing above this node exists inside Argo. What
     leaves the Project leaves the machine: two record directories on disk, two providers over
     HTTP, and one git checkout read through the shell.`,
  ],
  flows: ['flow-line', 'flow-turn'],
  concepts: ['c-session', 'c-tier', 'c-turn', 'c-plan', 'c-ask', 'c-workspace', 'c-person'],
  stale: {
    order: {
      what: 'the order these nine are read in',
      reason: null,
    },
  },
};

/* ------------------------------------------------------- DOMAINS (level 2) -- */
A.find = {
  kind: 'area', altitude: 'Domain', name: 'Finding the sessions', parent: 'argo',
  line: 'Decides which transcript files on this machine belong to this Project, and keeps that set current.',
  short: [
    `A CLI writes one directory per project and one file per session. It does not say which
     repository a file belongs to. This domain answers that question cheaply, and it answers it
     again as new files appear.`,
    `Two filters run in cost order. A modified-time window decides which files are worth opening.
     Each file that passes is opened at the head only, far enough to read the working directory.`,
    `Only a file that passes both filters is read in full and tailed. The order is the whole
     design. To open every transcript in a busy home directory is the expensive mistake.`,
  ],
  inside: [], // hand-written to one level for this study
  among: [],
  leaving: [
    `It hands the join a list of file URLs, and nothing else. One shared resolver spells every
     path. A symlinked checkout and its real path are the same Project, and they must not become
     two.`,
  ],
  concepts: ['c-session', 'c-workspace'],
};

A.read = {
  kind: 'area', altitude: 'Domain', name: 'Reading the record', parent: 'argo',
  line: 'Turns one growing JSONL file into typed events, in record order, live or from a fixture.',
  short: [
    `This domain has one job, and it runs in one direction. A line of JSON arrives at the end of
     a file, and a typed event comes out. Nothing here knows about a window. Nothing here decides
     what a Session is. That judgement belongs to the join.`,
    `Five areas run in order. Bytes become complete lines. A line becomes a record. A stateful
     reader turns records into events. A tool call is paired with the record that answered it.`,
    `The vocabulary of those events is an area of its own. Two layers depend on it, and neither
     layer can change it alone.`,
  ],
  long: [
    `This domain has one job, and it runs in one direction. A line of JSON arrives at the end of
     a file, and a typed event comes out. Nothing here knows about a window. Nothing here decides
     what a Session is. That judgement belongs to the join.`,
    `Five areas run in order. Bytes become complete lines. A line becomes a record. A stateful
     reader turns records into events. A tool call is paired with the record that answered it.
     The vocabulary of those events is an area of its own.`,
    `<b>Nothing here throws on bad input.</b> Another program writes the transcript while you
     read it. A line that does not parse is reported as unreadable. A record with a
     <code>type</code> that Argo does not know keeps its bytes.`,
    `<b>The batch stays whole.</b> Events come out as arrays, because the join folds one whole
     read at once. The first batch also tells the join that the file was read. An empty first
     batch and no first batch mean different things.`,
    `<b>Live and replay are the same code.</b> The only difference is where the file cursor
     starts. This is why the reader keeps so little state. State is the one thing that can make
     the two disagree.`,
  ],
  inside: ['read-lines', 'read-record', 'read-reader', 'read-outcome', 'read-vocab'],
  among: [
    `The five areas are a chain, and each one knows only the next one. Lines feed the record
     parser. Records feed the reader. The reader asks the outcome resolver when a record answers
     an open call.`,
    `All four speak the vocabulary, and the vocabulary knows none of them. Only one of the five
     remembers anything between lines. The other four are pure. That is what makes a fixture and
     a live tail interchangeable.`,
  ],
  leaving: [
    `Three edges leave this domain, and one of them is unusual. The ordinary edge is the join. A
     batch of events lands there, and the transcript is marked as settled.`,
    `The second edge is a pair of closures handed in from outside. One reads image bytes off
     disk. One reads the files of a skill. So this domain touches no file except the transcript.`,
    `The unusual edge is the event vocabulary, which crosses the package boundary <i>whole</i>.
     The feed projection switches over the same enum with no default case. A new event kind fails
     the build until the feed says what it looks like.`,
  ],
  concepts: ['c-turn', 'c-plan', 'c-ask', 'c-tier'],
};

A.join = {
  kind: 'area', altitude: 'Domain', name: 'The join', parent: 'argo',
  line: 'The only live state in the app: an in-memory picture of every Session in the Project.',
  short: [
    `Everything that Argo knows about a Session at this instant lives here. The join holds one
     entry per tailed transcript and folds each batch of events into it.`,
    `The join then rebuilds a roster of one Session per resume-chain. A resumed session writes a
     new file, so one Session can be four files.`,
    `The join also folds in what no transcript carries. Process liveness, the companion report,
     an open permission, the git workspace, and the chosen Mode all arrive from other domains.
     Each one is keyed by ownership, not by Session id.`,
    `The join is rebuildable by design. It is a picture, not a record, and nothing in it is
     written to disk.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `One file above the join can read it, and that file turns it into values. Below the join, it
     reads the working set, the event stream, the claim ledger, and the world. The world means
     git, process liveness, and path spelling.`,
  ],
  concepts: ['c-session', 'c-tier', 'c-workspace'],
};

A.project = {
  kind: 'area', altitude: 'Domain', name: 'The cockpit projection', parent: 'argo',
  line: 'The one seam between live state and views. It restates a Session as a plain value.',
  short: [
    `One file reads the join. Everything else in the view layer takes a value. A build gate
     enforces this rule. The gate greps for the type name across the whole package and allows one
     exemption.`,
    `The projection <i>restates</i> the Session. It does not wrap it. Every public fact on the
     engine Session must appear in the mapping, in a slot of its own name. A fact that is not
     projected must carry a line that says why.`,
    `A new fact on the engine fails the build until someone says which case it is. A fact that
     lands in a slot of another name also fails the build. The cost is a long file that looks
     like duplication. The benefit is that no view holds a reference to something that moves.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Upward it sends one value per pass, resolved once. Downward it reads the join, and the small
     set of readings that Argo owns.`,
  ],
  concepts: ['c-session', 'c-tier'],
};

A.surfaces = {
  kind: 'area', altitude: 'Domain', name: 'The feed and the roster', parent: 'argo',
  line: 'The two reading surfaces. Both take values, and neither can reach live state.',
  short: [
    `The roster answers "which Session". The feed answers "what happened in it". Both are
     projections of their own. Each one computes a list of rows once per pass, and then draws
     them.`,
    `The feed projection turns a transcript into something readable. It pairs calls with their
     outcomes, folds a run of small calls into one row, and folds images into a gallery.`,
    `The feed switches over the event enum of the engine with no default case. The compiler keeps
     the feed honest about a new kind of event.`,
    `An AppKit table draws the rows, not a SwiftUI list. The feed must hold its scroll position
     while new rows arrive at the bottom.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `It takes one reading per pass, and it sends intents back. It never reads the join.`,
  ],
  concepts: ['c-turn', 'c-plan', 'c-ask'],
};

A.drive = {
  kind: 'area', altitude: 'Domain', name: 'Driving a session', parent: 'argo',
  line: 'What Argo does to a Session: send a Turn, interrupt, answer a permission, walk the Mode ladder.',
  short: [
    `To read a transcript is most of Argo. This domain is the part that writes. One protocol
     names everything that Argo can ask of a running agent. Two adapters implement it, one per
     CLI, because the two CLIs agree on almost nothing.`,
    `Refusals are a closed set of cases. Each case carries the sentence that a person reads. Most
     failures here are not bugs. The session is not managed, or the Turn already runs, or the CLI
     does not support the rung that you asked for.`,
    `A Mode that you pick during a Turn is held, not sent. Argo walks it at the boundary of the
     Turn. Nobody can promise that a keystroke into a running agent arrives.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `It publishes into the same ledger that the join folds. A drive fact reaches the roster the
     way every other fact does.`,
    `The terminal that it drives lives in its own package. The terminal emulator links AppKit,
     and the engine must run with no window.`,
  ],
  concepts: ['c-turn', 'c-session'],
};

A.companion = {
  kind: 'area', altitude: 'Domain', name: 'The companion channel', parent: 'argo',
  line: 'One Unix socket per managed Session, and the only source of a fact that no transcript carries.',
  short: [
    `A bundled plugin points the CLI at a socket that Argo listens on. The agent then reports
     what no transcript carries. It reports what it does at this moment, that it is about to ask
     for a permission, and which tool it can use without asking again.`,
    `The socket is the capability. Its directory is private to this user, and only this user can
     read the socket. The file permissions are the whole of the access control.`,
    `The paths live under a short temporary directory, because the operating system caps a socket
     address at 103 bytes. The listen backlog is as high as the system allows. A refused dial is
     not a dropped message. It is a tool call left waiting.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `One closure into the claim ledger, keyed by ownership. Nothing here knows what a roster is.`,
  ],
  concepts: ['c-tier', 'c-session'],
};

A.ports = {
  kind: 'area', altitude: 'Domain', name: 'Accounts, tickets and delivery', parent: 'argo',
  line: 'Everything read through an external provider, which the join knows nothing about.',
  short: [
    `Two ports carry adapters: a ticket provider and a code host. An Account is one authenticated
     identity, and its token lives in the keychain. A Binding is the use of one Account by this
     Project, through one port.`,
    `Delivery is the product in flight. Argo derives it per branch, from git and from the code
     host, and never stores it. A branch that no longer exists must stop being claimed.`,
    `These facts travel <i>beside</i> the projection, not inside it. The window takes them as
     separate parameters. The join is a projection over observed Sessions, and a registered
     Account is not one. The seam that they share is a branch name.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Two providers over HTTP, the keychain, and the git checkout.`,
  ],
  concepts: ['c-workspace'],
};

A.owned = {
  kind: 'area', altitude: 'Domain', name: 'What Argo owns', parent: 'argo',
  line: 'The small set of facts that Argo asserts. Per-machine files, never committed.',
  short: [
    `Almost nothing. A registry of Projects. A name and an archived flag that a person set on a
     Session. The chain that a handoff belongs to. The chosen Mode. The Accounts that exist.`,
    `Each one is one small file, read and written whole. A nil location means that Argo remembers
     nothing at all, and that is how the tests run.`,
    `The rule behind the size is that Argo never stores an observed fact. Argo reads again
     anything that the record still holds. The durable state is only what it would otherwise
     lose. It lives under the application support of this machine, never in the repository.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `It goes into every other domain as file URLs, and each URL is named in one place.`,
  ],
  concepts: ['c-session'],
};
/* Eight of the nine domains are hand-written to one level only. #650 asks for ONE path top to
   bottom, so the prototype says so on the card rather than faking depth. */
['find', 'join', 'project', 'surfaces', 'drive', 'companion', 'ports', 'owned']
  .forEach(id => { A[id].unwritten = true; });

/* --------------------------------------------------------- AREAS (level 3) -- */
A['read-lines'] = {
  kind: 'area', altitude: 'Area', name: 'Lines out of a growing file', parent: 'read',
  line: 'Reads from the last offset, carries a half-written record, and rewinds when the file gets shorter.',
  short: [
    `Another process appends to the transcript while Argo reads it. A read can land in the middle
     of a record. This area keeps a cursor, hands back complete lines only, and holds the last
     fragment until the rest arrives.`,
    `It also handles a file that gets shorter. A CLI sometimes rewrites a transcript instead of
     appending to it. The cursor rewinds to the start, so it never reads garbage from the middle.`,
    `It drains once when it starts, with no prompt. Without that first drain, a file that never
     changes again is never read.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Complete lines, in order, to the record parser. Below it there is one file handle and one
     file-system watch.`,
  ],
  anchors: [
    ['ArgoEngine/Transcript/TranscriptTail.swift', 66, 'transcriptLines(at:) — the stream of complete lines'],
    ['ArgoEngine/Transcript/TranscriptTail.swift', 22, 'FileCursor.drain() — reads from the last offset'],
    ['ArgoEngine/Transcript/TranscriptTail.swift', 96, 'the per-file watch: extend, write, delete, rename'],
  ],
  concepts: [],
};

A['read-record'] = {
  kind: 'area', altitude: 'Area', name: 'One line into one record', parent: 'read',
  line: 'Parsing that never throws. A strange line is nothing, and an unknown record keeps its bytes.',
  short: [
    `One function, and its signature is the decision. To parse a line returns a record or
     nothing, and it never throws. A line that is not an object at all is nothing. The caller
     reports the file as unreadable at that point, and the read continues.`,
    `A record with a known shape and an unknown type becomes an unknown case that keeps its
     original bytes. That costs memory. It buys the ability to show something honest about a
     record that a newer CLI wrote.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Records to the reader. It depends on nothing but a JSON value.`,
  ],
  anchors: [
    ['ArgoEngine/Transcript/TranscriptRecord.swift', 39, 'TranscriptRecord — the record and its cases'],
    ['ArgoEngine/Transcript/TranscriptRecord.swift', 61, 'parse(line:) — never throws; unknown keeps its bytes'],
  ],
  concepts: [],
};

A['read-reader'] = {
  kind: 'area', altitude: 'Area', name: 'The reader that keeps state', parent: 'read',
  line: 'The actor that turns records into events. It is the only thing here that remembers anything.',
  short: [
    `An actor with four pieces of memory, and no more. It holds the tool calls that it saw and
     that nothing answered yet. A call and its result are separate records, and they can be
     hundreds of lines apart.`,
    `It holds a plan ledger. One host writes a plan one entry at a time, not whole, so the reader
     accumulates what that CLI does not give.`,
    `It holds a context cursor. Only some records restate the token usage, and the rest inherit
     the last reading. It holds the subject, which is the owner of this transcript. The subject
     decides at four gates whether a line belongs to a Subagent.`,
    `Everything else is a pure function of the record in hand. That balance is the design. State
     is the one thing that can make a live tail and a replay disagree, so there is just enough of
     it to be correct.`,
  ],
  long: [
    `An actor with four pieces of memory, and no more. It holds the tool calls that it saw and
     that nothing answered yet. A call and its result are separate records, and they can be
     hundreds of lines apart.`,
    `It holds a plan ledger. One host writes a plan one entry at a time, not whole, so the reader
     accumulates what that CLI does not give.`,
    `It holds a context cursor. Only some records restate the token usage, and the rest inherit
     the last reading. It holds the subject, which is the owner of this transcript.`,
    `The subject decides at four gates whether a line belongs to a Subagent. A sidechain record
     looks the same as a main-line record. To ask the same question at four gates costs less than
     one wrong answer.`,
    `Two of its outputs are worth knowing before you read the code. A record that carries a tool
     call can produce <i>two</i> events. It produces the call, and it produces a plan when the
     tool is the one that a CLI uses for its to-do list.`,
    `A question to the user is recognised here by the tool that carries it. The transcript has no
     notion of a question. It has a tool call with a particular name. That is why the feed can
     show a question that you can answer.`,
    `It is an actor, not a struct. The batch loop shares one reader. This is the one place in the
     domain where a second concurrent read gives a different answer.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Upward it emits events in batches. Sideways it asks the outcome resolver when a record
     answers an open call. Downward it depends on the record parser, and on nothing else.`,
  ],
  anchors: [
    ['ArgoEngine/Transcript/TranscriptReader.swift', 13, 'TranscriptReader — the actor'],
    ['ArgoEngine/Transcript/TranscriptReader.swift', 28, 'openCalls — calls seen but not yet answered'],
    ['ArgoEngine/Transcript/TranscriptReader.swift', 29, 'the plan ledger, for a host that writes a plan an entry at a time'],
    ['ArgoEngine/Transcript/TranscriptReader.swift', 63, 'read(line:) — parse, then dispatch'],
    ['ArgoEngine/Transcript/TranscriptSubject.swift', 8, 'the four sidechain guards'],
  ],
  concepts: ['c-turn', 'c-plan', 'c-ask'],
  bottom: true,
  stale: {
    leaving: {
      what: 'the edges leaving this Area',
      reason: `A type resolution across the package established this Claim. The last attempt found
               no build for this checkout.`,
    },
  },
};

A['read-outcome'] = {
  kind: 'area', altitude: 'Area', name: 'Pairing a call with its outcome', parent: 'read',
  line: 'Finds the record that answered a tool call, and picks its evidence in a fixed order.',
  short: [
    `A tool call is written when it starts. The answer comes later, sometimes much later, and
     sometimes never. The agent was interrupted, or the process died. This area resolves the
     answering record into an outcome, and it leaves a call open rather than guess.`,
    `Evidence is picked in one fixed order: a diff, then media, then output. Two readers of the
     same call always see the same thing.`,
    `One rule is harder to see. A call that started in the background reports a receipt, not a
     result. That receipt keeps the call <i>in progress</i>. Without this rule, every background
     delegation reads as finished at the moment it starts.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Outcomes back to the reader, and three evidence readers beside it.`,
  ],
  anchors: [
    ['ArgoEngine/Transcript/TranscriptReader+Outcome.swift', 36, 'the background-receipt rule'],
    ['ArgoEngine/Transcript/TranscriptReader+Outcome.swift', 83, 'evidence order: diff, then media, then output'],
  ],
  concepts: [],
};

A['read-vocab'] = {
  kind: 'area', altitude: 'Area', name: 'The event vocabulary', parent: 'read',
  line: 'The twenty cases that every layer above speaks, and the one engine type a view depends on.',
  short: [
    `One enum with twenty cases, and the values that they carry. A message, a thought, a tool
     call and its result, a plan, a question, a compaction marker, and a usage reading. The names
     are the names of the domain, and the file cites the model that they came from.`,
    `It is an area of its own, not a detail of the reader, because two layers depend on it. The
     join folds these events into a Session. The feed switches over the same enum with no default
     case.`,
    `A new kind of event fails the build until the feed says what it looks like. This is the one
     place where a view depends on an engine type this closely. The trade is deliberate: a
     compiler error instead of a row that quietly goes missing.`,
  ],
  inside: [],
  among: [],
  leaving: [
    `Two layers depend on it. It depends on nothing.`,
  ],
  anchors: [
    ['ArgoEngine/Session/TranscriptEvent.swift', 4, 'TranscriptEvent — twenty cases'],
    ['ArgoEngine/Session/ToolCall.swift', 32, 'ToolCall, its kind, its status'],
    ['ArgoEngine/Session/Evidence.swift', 129, 'ToolResult — diff, media or output'],
  ],
  concepts: ['c-turn', 'c-plan', 'c-ask'],
};

/* -------------------------------------------------------------- FLOWS ------ */
/* A Flow is ONE card with every step visible (#648). Nobody descends into it, and it is not paged. */
A['flow-line'] = {
  kind: 'flow', altitude: 'Flow', name: 'A line lands, and becomes a row', parent: 'argo',
  line: 'Nine steps, from a CLI that appends JSON to a row drawn in the feed.',
  short: [
    `Everything else in Argo hangs off this path. Follow it once, and the shape of the app is
     clear. The code is a pipeline with a join in the middle, a seam near the top, and a view
     that only draws values.`,
  ],
  steps: [
    ['The CLI appends a line, and the file system wakes Argo',
     `A watch over the record directory yields once per burst of changes. The bursts are
      coalesced, so a chatty agent does not wake the app on every token. A file that Argo already
      tails has its own watch, and it skips to step four.`,
     ['ArgoEngine/Discovery/RecordDirectoryWatcher.swift', 22]],
    ['The working set is swept again',
     `The sweep runs the two filters again: the modified-time window, then a head-read for the
      working directory. It produces the list of files that belong to this Project at this time.`,
     ['ArgoEngine/Discovery/SessionDiscovery.swift', 44]],
    ['A tail starts, or the existing tail continues',
     `Each new file is opened through the engine facade and added to the join. A file that
      vanished between the sweep and the open is skipped, not raised as an error.`,
     ['ArgoEngine/Hub/TranscriptWatch.swift', 182]],
    ['Bytes become complete lines',
     `The cursor reads from its last offset. It carries a half-written record forward, and it
      rewinds when the file got shorter.`,
     ['ArgoEngine/Transcript/TranscriptTail.swift', 22]],
    ['Lines become typed events',
     `The reader parses each line and dispatches it. It holds open calls until the record that
      answers them arrives. The batch stays whole.`,
     ['ArgoEngine/Transcript/TranscriptReader.swift', 63]],
    ['The batch is folded into the Session',
     `The join applies the events to the Session that owns them. It appends them, updates the
      lossy fold beside them, and marks the transcript as settled.`,
     ['ArgoEngine/Hub/HubJoin.swift', 51]],
    ['The roster is refolded, after every transcript settles',
     `Resume chains merge, so one Session with four transcript files is one row. A file that is
      queued but not yet read is left out, not shown empty.`,
     ['ArgoEngine/Hub/HubSessionChain.swift', 33]],
    ['The Hub publishes, and folds in what no transcript carries',
     `Liveness, provenance, the CLI, and the git workspace are attached as the roster is read.
      Every claim-keyed fact joins them: the companion report, an open permission, a standing
      allow, and a drive status.`,
     ['ArgoEngine/Hub/Hub+Roster.swift', 53]],
    ['The seam makes a value, and the feed draws rows',
     `One file restates each Session as a plain value, once per pass. The feed projection pairs
      calls with outcomes, folds runs and galleries, and maps each event to a row. An AppKit
      table draws them, so the scroll position survives new rows.`,
     ['ArgoUI/Shell/Deck/Feed/FeedProjection.swift', 122]],
  ],
  concepts: ['c-session', 'c-turn', 'c-tier'],
};

A['flow-turn'] = {
  kind: 'flow', altitude: 'Flow', name: 'You send a Turn, and the agent asks permission', parent: 'argo',
  line: 'Five steps in the other direction. This is the only direction in which Argo writes.',
  short: [
    `To read is most of Argo. This path writes, and it exists only for a Session that Argo
     started. Argo can read an agent that someone else launched, but it cannot steer one.`,
  ],
  steps: [
    ['The prompt reaches the driver',
     `One protocol names everything that Argo can ask of a running agent: send, interrupt,
      answer, and change Mode. It refuses in a closed set of cases, and each case carries the
      sentence that a person reads.`,
     ['ArgoEngine/Drive/SessionDriver.swift', 7]],
    ['The adapter for that CLI does it its own way',
     `Two adapters implement the protocol. They share the vocabulary, and almost nothing else.`,
     ['ArgoEngine/Drive/SessionDriver.swift', 106]],
    ['The agent meets a tool that needs permission, and dials the socket',
     `The companion plugin reports the pending permission over a Unix socket that is private to
      this user. Argo never refuses the dial when it can help it. A refused dial leaves a tool
      call waiting.`,
     ['ArgoEngine/Companion/CompanionChannel.swift', 54]],
    ['The fact lands in the ledger, keyed by ownership',
     `It arrives as a fact, not as an event, because it never existed in a transcript. This is
      the whole of the CONVENTION rung.`,
     ['ArgoEngine/Hub/ClaimLedger.swift', 20]],
    ['The roster shows a Session that waits on you',
     `The published Session carries the permission. Its status takes the quieter reading when
      anything is ambiguous. Your answer travels back down the same socket.`,
     ['ArgoEngine/Hub/Hub+Roster.swift', 73]],
  ],
  concepts: ['c-turn', 'c-tier', 'c-session'],
};

/* ------------------------------------------------------------ CONCEPTS ----- */
/* A Concept sits at Project level, does not nest, and drills into its evidence (#647). */
A['c-session'] = {
  kind: 'concept', altitude: 'Concept', name: 'Session', parent: 'argo',
  line: 'One logical resume-chain, and the root agent in it.',
  short: [
    `A Session is not a file. To resume an agent writes a <i>new</i> transcript. One Session is a
     chain of files folded together, and the id that survives is the id of the chain.`,
    `The code spells this word in more places than any other. The name appears in two hundred of
     the four hundred and eighty-four source files. Ten of those files are in the directory
     called Session.`,
    `A map drawn from folders puts this concept in the wrong place. That is why the atlas does
     not draw one.`,
  ],
  evidence: [
    ['ArgoEngine/Hub/HubSession.swift', 4, 'the joined Session, as the Hub holds it'],
    ['ArgoUI/Shell/CockpitPresentation+Session.swift', 5, 'the same Session, restated as a value'],
    ['ArgoEngine/Hub/HubSessionChain.swift', 26, 'the resume-chain fold — why a Session is not a file'],
    ['ArgoEngine/Discovery/SessionDiscovery.swift', 13, 'how a Session is found in the first place'],
  ],
};

A['c-tier'] = {
  kind: 'concept', altitude: 'Concept', name: 'Honesty tier', parent: 'argo',
  line: 'A property of each shown fact: how Argo knows it.',
  short: [
    `Three rungs. DIRECT is a fact that Argo owns, such as a process that it started or a Mode
     that it set. DERIVED is observed from outside. CONVENTION arrived over the companion
     channel, and it never existed in a transcript.`,
    `The rule that matters is what happens when a fact is ambiguous. It takes the lower rung and
     the quieter state. Argo never shows a false DIRECT.`,
    `That is why every tier-gated value has an explicit unknown. A Session whose liveness Argo
     cannot establish honestly reads as unknown, not as idle.`,
  ],
  evidence: [
    ['ArgoEngine/Session/Honesty.swift', 5, 'the three rungs, as a type'],
    ['ArgoEngine/Hub/HubSession+Status.swift', 26, 'tier precedence when two readings disagree'],
    ['ArgoEngine/Session/SessionStatus.swift', 48, 'degrade-down, at one of the places it is applied'],
  ],
};

A['c-turn'] = {
  kind: 'concept', altitude: 'Concept', name: 'Turn', parent: 'argo',
  line: 'One exchange: a prompt in, a stop reason out.',
  short: [
    `A Turn is the unit that a Session is made of, and it ends for a reason. The agent finished,
     or it ran out of tokens, or it refused.`,
    `The stop reason is why the roster says <i>stopped</i> and not <i>failed</i>. To stop short
     is not to crash.`,
    `The code spells the word in two places, for two purposes. One is the state of the Turn as
     read out of a transcript. One is the delivery of a Turn that Argo sends. Both are real, and
     they are not the same object.`,
  ],
  evidence: [
    ['ArgoEngine/Session/SessionTurnState.swift', 1, 'the Turn as observed'],
    ['ArgoEngine/Drive/TurnDelivery.swift', 1, 'the Turn as sent'],
    ['ArgoEngine/Session/StopReason.swift', 1, 'why it ended'],
  ],
};

A['c-plan'] = {
  kind: 'concept', altitude: 'Concept', name: 'Plan', parent: 'argo',
  line: "The live to-do list of the agent. It belongs to the Session, and it is replaced whole.",
  short: [
    `A Plan belongs to the Session, not to the Turn that wrote it. A Turn carries a snapshot
     only. That is why the feed can show a plan from three Turns ago and still call it current.`,
    `One CLI writes a plan whole. One CLI writes it an entry at a time. That is why the reader
     keeps a ledger. The concept exists in both hosts, but only one host gives it in one piece.`,
  ],
  evidence: [
    ['ArgoEngine/Session/Plan.swift', 19, 'the Plan, its entries and their statuses'],
    ['ArgoEngine/Transcript/PlanLedger.swift', 1, 'the accumulation a host with no whole plan forces'],
  ],
};

A['c-ask'] = {
  kind: 'concept', altitude: 'Concept', name: 'Ask', parent: 'argo',
  line: 'A structured question put to the person, and the live handle that answers it.',
  short: [
    `Two types, and they are deliberately not one. The first is the question as it appears in the
     record. It is readable in any Session, including one that Argo never started.`,
    `The second is a live handle that you can answer. It exists only for a managed Session.`,
    `To collapse the two gives you a question that you can see and cannot answer, in the same
     type as one that you can. That is the false promise that the honesty tier prevents.`,
  ],
  evidence: [
    ['ArgoEngine/Session/Ask.swift', 1, 'the question, as read'],
    ['ArgoEngine/Drive/SessionAsk.swift', 1, 'the question, as answerable'],
    ['ArgoEngine/Session/ToolCall.swift', 73, 'the tool call a question actually arrives as'],
  ],
  stale: {
    evidence: {
      what: 'one of the three places this Concept is spelled',
      reason: null,
      anchorGone: true,
    },
  },
};

A['c-workspace'] = {
  kind: 'concept', altitude: 'Concept', name: 'Workspace', parent: 'argo',
  line: 'The git working context. It holds the branch, which is the join key.',
  short: [
    `A Workspace is where an agent works. It is a checkout or a worktree, with a branch.`,
    `The branch carries weight beyond this domain. It is the key that joins delivery facts from
     the code host to a Session. Nothing else that the two sides know is the same.`,
  ],
  evidence: [
    ['ArgoEngine/Repository/WorkspaceProjection.swift', 6, 'the projection, and the branch it carries'],
    ['ArgoEngine/Repository/WorkspaceProjection.swift', 15, 'branch as the join key'],
  ],
};

A['c-person'] = {
  kind: 'concept', altitude: 'Concept', name: 'Person', parent: 'argo',
  line: 'me or other. None found in the code.',
  short: [
    `The model names a Person, which is <code>me</code> or <code>other</code>. The code does not
     spell it. There is no such type. Authorship travels where it is needed, and nowhere in
     general.`,
    `<b>None found</b> is not the same as <i>there is none</i>. Argo can claim an absence only
     where something declares the set. Nothing here declares the set of types of this Project.`,
    `So this card says what it looked for, and what came back. Then it stops.`,
  ],
  evidence: [],
  noneFound: `A search of the engine declarations for a Person type found no match. The nearest
              thing is the holders of a Workspace, and that is a different question.`,
};
