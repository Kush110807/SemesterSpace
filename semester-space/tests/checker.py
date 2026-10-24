#!/usr/bin/env python3
"""Independent, dependency-free fraction oracle for tiny SemesterSpace decisions.

This is deliberately not a port of the engine's validation, calendar, search or
marker implementation. It generates small one-register problems, enumerates all
absence subsets and compares a simple Fraction chronology oracle against the
public JavaScript engine. It checks FEASIBILITY, not greedy optimality.
"""
from __future__ import annotations
from datetime import date, timedelta
from fractions import Fraction
from itertools import combinations
from pathlib import Path
import json
import random
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DATE0 = date(2026, 11, 2)
JS = r"""
import {makeCombinedModel,makeSession,FIXED_CLOCK} from './src/shared/fixtures.js';
import {evaluatePlan} from './src/engine/index.js';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const cases=JSON.parse(raw);
const results=cases.map(c=>{
  const m=makeCombinedModel();
  m.snapshots[0].counts.lecture={attended:c.a,held:c.h};
  m.registers[0].requiredBps=c.floor;m.registers[0].bufferBps=0;
  m.sessions=c.weights.map((w,i)=>makeSession(`ref-${i}`,c.dates[i],'lecture',w));
  m.schedule.teachingEnd=c.dates.at(-1);
  m.preferences.candidateEnd=c.dates.at(-1);
  const missed=c.missed.map(i=>c.dates[i]);
  const r=evaluatePlan(m,{additionalDates:missed,clock:FIXED_CLOCK});
  return {status:r.status,firstFailure:r.firstFailure?.sessionId??null,
          kind:r.firstFailure?.kind??null,counts:r.registers[0]?.final??null};
});
process.stdout.write(JSON.stringify(results));
"""

def fraction_ok(a: int, h: int, floor: int) -> bool:
    return h == 0 or Fraction(a, h) >= Fraction(floor, 10000)


def independent_reference(case: dict) -> tuple[str, str | None, str | None, tuple[int, int] | None]:
    a, h, floor = case['a'], case['h'], case['floor']
    weights = case['weights']
    below = not fraction_ok(a, h, floor)
    recovery = None
    if below:
        test_a, test_h = a, h
        for i, weight in enumerate(weights):
            test_a += weight
            test_h += weight
            if fraction_ok(test_a, test_h, floor):
                recovery = i
                break
        if recovery is None:
            return 'EXISTING_UNRECOVERABLE_SHORTFALL', None, 'RECOVERY', None
    failure_idx = None
    failure_kind = None
    for i, weight in enumerate(weights):
        missed = i in case['missed']
        h += weight
        if not missed:
            a += weight
        if failure_idx is None:
            if below and i <= recovery and missed:
                failure_idx, failure_kind = i, 'RECOVERY'
            elif (not below or i >= recovery) and not fraction_ok(a, h, floor):
                failure_idx, failure_kind = i, 'ATTENDANCE'
    if failure_idx is not None:
        return 'PLAN_BLOCKED', f'ref-{failure_idx}', failure_kind, (a, h)
    return ('CONDITIONAL_RECOVERY' if below else 'MEETS_PLANNING_RULES', None, None, (a, h))


def build_cases():
    rng = random.Random(20261024)
    scenarios = [
        (79, 100, 7800, [1, 1]),
        (37, 48, 7800, [1, 1]),
        (0, 0, 7800, [1, 2]),
        (9, 10, 10000, [1, 1]),
        (40, 50, 7800, [1, 1, 1, 1]),
        (77999, 100000, 7800, [1]),
    ]
    for _ in range(45):
        h = rng.randrange(0, 48)
        a = rng.randrange(h + 1)
        floor = rng.choice([7000, 7500, 7800, 8500, 10000])
        weights = [rng.randint(1, 3) for _ in range(rng.randint(1, 4))]
        scenarios.append((a, h, floor, weights))
    cases = []
    for a, h, floor, weights in scenarios:
        dates = [(DATE0 + timedelta(days=i)).isoformat() for i in range(len(weights))]
        for count in range(len(weights) + 1):
            for subset in combinations(range(len(weights)), count):
                cases.append(dict(a=a, h=h, floor=floor, weights=weights, dates=dates, missed=list(subset)))
    return cases


def main() -> int:
    cases = build_cases()
    result = subprocess.run(['node', '--input-type=module', '-e', JS], cwd=ROOT,
                            input=json.dumps(cases), text=True, capture_output=True, check=False)
    if result.returncode != 0:
        print('ERROR: public JavaScript engine runner failed:\n' + result.stderr)
        return 2
    try:
        observed = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        print('ERROR: invalid JavaScript engine output:', exc)
        return 2
    if len(observed) != len(cases):
        print('ERROR: output length mismatch')
        return 2
    mismatches = []
    for i, (case, actual) in enumerate(zip(cases, observed)):
        status, failure_id, kind, counts = independent_reference(case)
        if (actual['status'], actual['firstFailure'], actual['kind']) != (status, failure_id, kind):
            mismatches.append((i, case, (status, failure_id, kind), actual))
        elif counts is not None and actual['status'] != 'INVALID_SETUP':
            final = actual['counts']
            if final is None or (final['attended'], final['held']) != counts:
                mismatches.append((i, case, counts, final))
    if mismatches:
        print(f'FAIL: {len(mismatches)}/{len(cases)} mismatches. First 8:')
        for item in mismatches[:8]:
            print(item)
        return 1
    print(f'PASS: {len(cases)} public-engine decisions match independent Fraction arithmetic across exhaustive tiny absence subsets.')
    print('Independent feasibility evidence only; not a greedy optimality test or UI verification.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
