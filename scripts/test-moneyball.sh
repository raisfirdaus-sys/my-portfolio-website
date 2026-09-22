#!/bin/sh
# Run every Moneyball engine check. From the repo root: sh scripts/test-moneyball.sh
set -e
# A conflict marker committed into a .js file is a parse error, which takes
# the whole page down - no board, no tabs, nothing. It shipped once. Never
# again: this runs before anything else, because a broken file makes every
# other result meaningless.
printf '=== conflict markers ===\n'
if grep -rnE '^(<{7}|={7}|>{7})( |$)' js/ css/ scripts/ data/ ./*.html 2>/dev/null; then
  echo "FAIL: penanda konflik git masih ada di berkas di atas."
  exit 1
fi
echo "  ok   tidak ada penanda konflik"

# Every browser file must at least parse.
printf '=== syntax ===\n'
for f in js/*.js; do
  node --check "$f" || { echo "FAIL: $f tidak bisa di-parse."; exit 1; }
  echo "  ok   $f"
done

for t in test-engine test-anchor test-data; do
  printf '=== %s ===\n' "$t"
  node "scripts/$t.js"
done
echo
echo "All Moneyball tests passed."
