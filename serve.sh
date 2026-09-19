#!/usr/bin/env bash
# Serve the portfolio locally. Open http://localhost:8080
#
# The site is plain static files: you can also just open index.html in a
# browser. Serving it is closer to how it behaves once hosted.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8080}"
echo "→ http://localhost:$PORT   (ctrl-c to stop)"
python3 -m http.server "$PORT" --bind 127.0.0.1
