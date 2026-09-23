#!/bin/sh
# Run every Moneyball engine check. From the repo root: sh scripts/test-moneyball.sh
set -e
# A conflict marker committed into a .js file is a parse error, which takes
# the whole page down - no board, no tabs, nothing. It shipped once. Never
# again: this runs before anything else, because a broken file makes every
# other result meaningless.
printf '=== conflict markers ===\n'
if grep -rnE '^(<{7}|={7}|>{7})( |$)' js/ css/ scripts/ data/ ./*.html 2>/dev/null; then
  echo "FAIL: git conflict markers are still present in the files above."
  exit 1
fi
echo "  ok   no conflict markers"

# Every browser file must at least parse.
printf '=== syntax ===\n'
for f in js/*.js; do
  node --check "$f" || { echo "FAIL: $f does not parse."; exit 1; }
  echo "  ok   $f"
done

for t in test-engine test-anchor test-data; do
  printf '=== %s ===\n' "$t"
  node "scripts/$t.js"
done

printf '=== test-news-filter ===\n'
node scripts/test-news-filter.mjs

printf '=== test-news-ui ===\n'
node scripts/test-news-ui.mjs

printf '=== test-topteams ===\n'
node scripts/test-topteams.mjs

printf '=== test-bulk-table ===\n'
node scripts/test-bulk-table.mjs

printf '=== test-whoscored-flow ===\n'
node scripts/test-whoscored-flow.mjs

printf '=== test-snapshot ===\n'
node scripts/test-snapshot.mjs

printf '=== test-published-stats ===\n'
node scripts/test-published-stats.mjs

printf '=== test-board-moves ===\n'
node scripts/test-board-moves.mjs

printf '=== test-language ===\n'
node scripts/test-language.mjs
echo
echo "All Moneyball tests passed."
