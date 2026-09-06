#!/bin/bash
set -e
export PATH="$HOME/.local/bin:$PATH"
export GIT_EDITOR=true
export GIT_TERMINAL_PROMPT=0
cd "/mnt/e/判充/chat"

git config user.email "379982426@qq.com"
git config user.name "panchong"

git add -A
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "already has commits"
else
  git -c core.editor=true commit -m "Initial commit: panchong miniprogram"
fi

echo "=== create repo ==="
CREATE_OUT=$(origin repo create panchong-chat 2>&1) || CREATE_OUT=$(origin repo create panchong 2>&1) || true
echo "$CREATE_OUT"

URL=$(echo "$CREATE_OUT" | grep -Eo 'https://origin\.cursor\.com/[^[:space:]]+' | head -1)
echo "URL=$URL"
if [ -z "$URL" ]; then
  echo "failed to get clone URL"
  origin repo list || true
  exit 1
fi

git remote remove origin 2>/dev/null || true
git remote add origin "$URL"
git push -u origin main
echo "PUSH_OK"
origin repo list
