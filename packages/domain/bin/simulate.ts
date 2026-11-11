import { writeFileSync } from 'node:fs';
import { POLICY_IDS, type PolicyId } from '../src/simulate/policies.js';
import { simulate } from '../src/simulate/run.js';

/**
 * `pnpm --filter @warewolf/domain simulate -- --games 1000 --seed 1 --out report.json`
 * Prints a short summary. The JSON file is the report.
 */
const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const games = Number(value('--games') ?? 1000);
const seed = Number(value('--seed') ?? 1);
const presetId = value('--preset') ?? 'infection-core';
const policyId = (value('--policy') ?? 'random-legal') as PolicyId;
const out = value('--out') ?? 'infection-simulation.json';

if (!Number.isInteger(games) || games < 1) throw new Error('--games must be a positive integer');
if (!Number.isInteger(seed)) throw new Error('--seed must be an integer');
if (!POLICY_IDS.includes(policyId)) throw new Error(`--policy must be one of ${POLICY_IDS.join(', ')}`);

const report = simulate({ presetId, games, seed, policyId });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.finished} ${report.presetId} games finished. seed ${report.seed}, policy ${report.policyId}.`);
console.log(`village ${report.finish.VILLAGE}, wolves ${report.finish.WOLF_PACK}, draw ${report.finish.draw}.`);
console.log(`doctor negated ${report.doctorNegatedFraction.toFixed(3)} of wolf attacks. wrote ${out}`);
console.log(report.note);
