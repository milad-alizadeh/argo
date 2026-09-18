// The Session index is a rebuildable cache and never a source of truth: CLI transcript files stay
// the authoritative Session store (CONTEXT.md · Storage & ownership, ADR-0008). Everything here is
// derived, so a database that is missing, damaged or written by another version is dropped and
// built again rather than repaired.

// Bumped whenever a table below changes shape or a parser changes what a cached Roster row says:
// `row_json` is keyed by file identity, so an unchanged file keeps the old projection until the
// index is discarded. An index at any other version is discarded.
export const SESSION_INDEX_VERSION = 3

// One row per transcript file Argo has parsed, keyed by the identity that says whether it changed:
// path, modification time and size together, because a file appended to inside one mtime tick
// reads as unchanged on a coarse filesystem (#2241).
//
// One row per logical Session, holding the validated Roster projection its chain produced, and
// whether it stands under a retired id because its origin was unread: a stranded half re-stitches
// with every later pass, which is what joins it to an origin that only appears afterwards. The
// projection is stored whole rather than as columns because the Roster row is one validated shape
// and splitting it would give the index a second opinion about what a row is.
//
// One row per transcript file's own Session id, naming the file it resumed. This is what
// `ChainHistory` holds in memory, persisted: a resume link never changes, so a chain keeps its id
// across a restart instead of promoting a resumed half to a root (#2290).
//
// One row per CLI naming how far background backfill has walked into older history: the newest
// file it has not yet reached, ordered the way the recent window is (written time, then path to
// break a tie). `complete` is set once no file on disk is older than that boundary, so a restart
// resumes from where the last batch stopped instead of reading the whole tree again (#2373).
export const SESSION_INDEX_SCHEMA = `
CREATE TABLE transcript_file (
  cli TEXT NOT NULL,
  path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  written_at REAL NOT NULL,
  size INTEGER NOT NULL,
  chain_id TEXT NOT NULL,
  PRIMARY KEY (cli, path)
) STRICT;
CREATE INDEX transcript_file_chain ON transcript_file (cli, chain_id);

CREATE TABLE session_chain (
  cli TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  updated_at TEXT,
  origin_unread INTEGER NOT NULL,
  row_json TEXT NOT NULL,
  PRIMARY KEY (cli, chain_id)
) STRICT;

CREATE TABLE chain_link (
  cli TEXT NOT NULL,
  session_id TEXT NOT NULL,
  parent_session_id TEXT,
  PRIMARY KEY (cli, session_id)
) STRICT;

CREATE TABLE backfill_progress (
  cli TEXT PRIMARY KEY,
  boundary_written_at REAL,
  boundary_path TEXT,
  complete INTEGER NOT NULL
) STRICT;
`
