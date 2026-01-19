const Database = require('better-sqlite3');
const db = new Database('./voids/test-session3.db');

console.log('=== NODES ===');
const nodes = db.prepare('SELECT id, url, domain FROM nodes').all();
nodes.forEach(n => console.log(`  ${n.domain}: ${n.url}`));

console.log('\n=== EDGES (sample) ===');
const edges = db.prepare('SELECT source_id, target_id FROM edges LIMIT 20').all();
edges.forEach(e => console.log(`  ${e.source_id} -> ${e.target_id}`));

console.log(`\nTotal edges: ${db.prepare('SELECT COUNT(*) as c FROM edges').get().c}`);
db.close();
