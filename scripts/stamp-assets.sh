#!/bin/sh
# Rewrite the ?v= cache-busting stamp on moneyball.html's own assets.
#
# GitHub Pages and browsers cache css/js aggressively. The data file already
# busts its own cache from JavaScript, so a stale script paired with fresh
# data is the worst case: the page looks updated and behaves like an old
# build. Run this before committing any change to moneyball's css or js.
#
#   sh scripts/stamp-assets.sh
set -e
cd "$(dirname "$0")/.."
STAMP=$(git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)
STAMP="${STAMP}-$(date -u +%H%M%S)"
sed -i.bak -E "s#(css/moneyball\.css|js/moneyball-engine\.js|js/moneyball-app\.js)\?v=[^\"']*#\1?v=${STAMP}#g" moneyball.html
rm -f moneyball.html.bak

# Same stamp into a meta tag, and into a tiny file the page fetches with the
# cache defeated. GitHub Pages serves HTML with its own max-age, so a reader
# on a plain URL can get yesterday's page with today's data - which is the
# worst failure mode, because it looks like it worked. The page compares the
# two and reloads itself once when they disagree.
sed -i.bak -E "s#(<meta name=\"build\" content=\")[^\"]*#\1${STAMP}#" moneyball.html
rm -f moneyball.html.bak
printf '{"build":"%s"}\n' "${STAMP}" > build.json

echo "stamped moneyball.html assets with v=${STAMP}"
grep -o -E '(css/moneyball\.css|js/moneyball-[a-z]+\.js)\?v=[^"'"'"']*' moneyball.html
