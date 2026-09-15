// The <N>-<slug> shape shared by worktree directories, branches, and EnterWorktree's `name:`.
// Split from worktree-names.mjs on file length alone.
export const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
// A numberless slug may not itself start with a number: `901-naming` is a dropped `#`, and
// nothing downstream can tell it from work that genuinely has no ticket.
export const NAMELESS = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*'

// EnterWorktree's raw `name:` often already carries the real <N>-<slug> (or a numberless <slug>)
// an agent meant to use — it just can't reach the convention through that tool (#1684). Read it
// back out so a refusal can hand over a ready command instead of the <N>/<slug> template (#2202).
export function recipeFor(name, { dir, branchPrefix }) {
  if (!branchPrefix || typeof name !== 'string') return null
  const withTicket = new RegExp(`^(\\d+)-(${SLUG})$`).exec(name)
  if (withTicket) {
    const [, number, slug] = withTicket
    return { dir: `${dir}/ticket-${number}-${slug}`, branch: `${branchPrefix}#${number}-${slug}` }
  }
  if (new RegExp(`^${NAMELESS}$`).test(name)) {
    return { dir: `${dir}/ticket-${name}`, branch: `${branchPrefix}${name}` }
  }
  return null
}

// The two-step refusal message, with real values in place of it when `name` parses.
export function twoStepMessage(name, { named, dir, tree, branchShape, enter }) {
  const branchPrefix = branchShape.replace(/#<N>-<slug>$/, '')
  const recipe = named ? recipeFor(name, { dir, branchPrefix }) : null
  const branch = recipe ? `'${recipe.branch}'` : branchShape
  const target = recipe ? recipe.dir : `${dir}/${tree}`
  const step = recipe
    ? `Enter the tree it makes by path: EnterWorktree { path: "${recipe.dir}" } in Claude Code, cd in any other harness.`
    : enter
  return `Create the tree with git: git worktree add -b ${branch} ${target}. ${step}`
}
