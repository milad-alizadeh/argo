// The #2934 isolated SQLite timings, plans and scan counts for the Session List statements.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function sqlMeasurements(userData: string, projectId: string, updatedSessionId: string) {
  const databaseFile = path.join(userData, 'argo.sqlite')
  const database = new DatabaseSync(databaseFile)
  const listColumns = `session.argo_id, session.harness, session.native_id,
    session.custom_title, session.preview, session.first_prompt, session.cwd,
    session.workspace_id, session.activity_at, session.updated_at,
    session_ticket_link.project_id, session_ticket_link.ticket_key,
    ticket_content.title, ticket_content.state, session_ticket_link.created_at`
  // The corpus has one Ticket scope, so the key alone finds the linked Ticket.
  const listFrom = `FROM session LEFT JOIN session_ticket_link
    ON session_ticket_link.session_id = session.argo_id
    LEFT JOIN ticket_content ON ticket_content.ticket_id = (SELECT keyed.ticket_id
      FROM ticket_content AS keyed WHERE keyed.key = session_ticket_link.ticket_key LIMIT 1)`
  const inProject = 'session.project_id = ?'
  const archived = `EXISTS
    (SELECT 1 FROM session_archive WHERE session_archive.session_id = session.argo_id)`
  const active = `${inProject} AND NOT ${archived}`
  const matching = `instr(lower(coalesce(session.custom_title, ticket_content.title,
      session.preview, session.first_prompt, '')), lower(?)) > 0`
  const listOrder = `ORDER BY session.sort_order ASC, session.created_at DESC, session.argo_id ASC
    LIMIT 30 OFFSET 0`
  const browse = `SELECT ${listColumns} ${listFrom} WHERE ${active} ${listOrder}`
  const search = `SELECT ${listColumns} ${listFrom} WHERE ${active} AND ${matching} ${listOrder}`
  const archive = `SELECT ${listColumns} ${listFrom} WHERE ${inProject} AND ${archived} ${listOrder}`
  const count = `SELECT count(*) FROM session WHERE ${active}`
  const queries = [
    { name: 'browse', sql: browse, arguments: [projectId] },
    { name: 'search', sql: search, arguments: [projectId, 'Needle'] },
    { name: 'search broad', sql: search, arguments: [projectId, 'Session'] },
    { name: 'count', sql: count, arguments: [projectId] },
    { name: 'archive', sql: archive, arguments: [projectId] },
  ]
  const measurements = queries.map((query) => {
    const statement = database.prepare(query.sql)
    const runs: number[] = []
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now()
      statement.all(...query.arguments)
      runs.push(Number((performance.now() - started).toFixed(4)))
    }
    const plan = database.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.arguments)
    let literalSql = query.sql
    for (const argument of query.arguments)
      literalSql = literalSql.replace('?', `'${String(argument).replaceAll("'", "''")}'`)
    const scanStats = execFileSync('sqlite3', ['-cmd', '.scanstats on', databaseFile, literalSql], {
      encoding: 'utf8',
    })
    return { name: query.name, sql: query.sql, runsMs: runs, plan, scanStats }
  })
  const update = database.prepare('UPDATE session SET preview = ? WHERE argo_id = ?')
  const commitsMs: number[] = []
  for (let index = 0; index < 20; index += 1) {
    database.exec('BEGIN')
    update.run(`Updated preview ${index}`, updatedSessionId)
    const started = performance.now()
    database.exec('COMMIT')
    commitsMs.push(Number((performance.now() - started).toFixed(4)))
  }
  database.close()
  return { measurements, commitsMs }
}
