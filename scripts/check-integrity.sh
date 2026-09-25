#!/bin/sh
# One second, run AFTER every merge and BEFORE every push.
#
# On 26 September 2026 a merge left a conflict marker inside
# data/moneyball-fixtures.json. The full test suite takes about two minutes
# and had been run before the merge, not after it, so the marker was
# committed, pushed and merged - and the page could not load its data for
# anyone until it was found. This is the part of the suite that has to run
# at the one moment the long suite is easy to skip.
set -e
bad=$(git ls-files | grep -E '\.(js|mjs|json|html|css|sh|md|txt|yml|yaml)$' \
      | xargs grep -lnE '^(<{7}|={7}|>{7})( |$)' 2>/dev/null || true)
if [ -n "$bad" ]; then
  echo "FAIL: conflict markers in:"; echo "$bad"; exit 1
fi
for f in data/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" \
    || { echo "FAIL: $f is not valid JSON"; exit 1; }
done
echo "  ok   no conflict markers, every data file parses"
