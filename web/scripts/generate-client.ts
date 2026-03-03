import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';
import path from 'path';
import fs from 'fs';

const idlPath = path.join(__dirname, '../reputation_oracle.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

const codama = createFromRoot(rootNodeFromAnchor(idl));

const outputPath = path.join(__dirname, '../generated/reputation-oracle');

if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { recursive: true });
}

codama.accept(renderVisitor(outputPath));

console.log('Client generated at:', outputPath);
