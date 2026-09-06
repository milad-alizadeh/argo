import { readFileSync, writeFileSync } from 'node:fs';

const KEEP = ['rloc','loc','complexity','max_complexity_per_function','number_of_functions',
  'comment_lines','long_method','max_parameters_per_function',
  'number_of_commits','number_of_authors','age_in_weeks','highly_coupled_files'];

const src = JSON.parse(readFileSync(process.argv[2], 'utf8')).data;

const find = (node, parts) => parts.reduce((n, p) => n && (n.children || []).find(c => c.name === p), node);
/* The subtree to map, and where it sits on disk. Nothing downstream may guess this: the
   notes pipeline resolves a map path back to a real file through it. */
const SUB = (process.env.ATLAS_SUBTREE || 'apps/macOS').split('/');
const sub = find(src.nodes[0], SUB);

let files = 0;
function trim(n) {
  if (n.type === 'File') {
    if (!(n.attributes && n.attributes.rloc)) return null;
    files++;
    const a = {};
    for (const k of KEEP) if (n.attributes[k] != null) a[k] = n.attributes[k];
    return { name: n.name, type: 'File', attributes: a };
  }
  const kids = (n.children || []).map(trim).filter(Boolean);
  if (!kids.length) return null;
  return { name: n.name, type: 'Folder', attributes: {}, children: kids };
}

const nodes = [trim(sub)];

/* gitlogparser's edges are the pairs of files that keep changing in the same commit, which
   is the relation the studio draws between blocks. They are kept in the page's own path
   form, and only when both ends survived the trim. */
const alive = new Set();
(function walk(n, path) {
  const here = path ? path + '/' + n.name : n.name;
  if (n.type === 'File') alive.add(here);
  else (n.children || []).forEach(c => walk(c, here));
})(nodes[0], '');

const rel = s => s.replace(new RegExp('^/root/' + SUB.slice(0, -1).join('/') + '/'), '');
const edges = (src.edges || [])
  .map(e => [rel(e.fromNodeName), rel(e.toNodeName), +(e.attributes.temporal_coupling).toFixed(3)])
  .filter(([a, b]) => alive.has(a) && alive.has(b))
  .sort((a, b) => b[2] - a[2]);

const out = { projectName: SUB.join('/'), sourceRoot: SUB.slice(0, -1).join('/'),
              apiVersion: src.apiVersion,
              attributeDescriptors: src.attributeDescriptors, nodes, edges };
writeFileSync(process.argv[3], JSON.stringify(out));
console.log('files', files, 'edges', edges.length, 'bytes', JSON.stringify(out).length);
