#!/bin/bash
# The page checks in a real WebKit (the iPad's engine): typing in a long chapter, saving offline and reconnecting,
# moving a chapter, keeping a change in the Edit room, the Rewrite tab's light staying in the page, and the team
# watcher. They drive the built app (npm run build, then npx vite preview --port 4173) against a pretend GitHub that
# starts from demo-vault/. Needs: apt-get install webkit2gtk-driver xvfb. Run every one, or name some: run.sh box edit
cd "$(dirname "$0")"
export no_proxy=localhost,127.0.0.1 NO_PROXY=localhost,127.0.0.1
fail=0
for s in ${@:-box live chapters edit light watch}; do
  echo "== $s"
  timeout 900 node $s.mjs 2>&1 | tail -25 | cut -c1-600
  [ "${PIPESTATUS[0]}" = 0 ] || { fail=1; echo "!! $s FAILED"; }
  pkill -f WebKitWebDriver; pkill Xvfb; rm -f /tmp/.X99-lock; sleep 2
done
echo "RESULT fail=$fail"
exit $fail
