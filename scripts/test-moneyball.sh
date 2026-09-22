#!/bin/sh
# Run every Moneyball engine check. From the repo root: sh scripts/test-moneyball.sh
set -e
for t in test-engine test-anchor test-data; do
  printf '=== %s ===\n' "$t"
  node "scripts/$t.js"
done
echo
echo "All Moneyball tests passed."
