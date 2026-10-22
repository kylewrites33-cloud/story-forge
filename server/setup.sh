#!/usr/bin/env bash
# Sparrow: set up a small Ubuntu computer as the always-on job runner.
# Run once as root on a fresh Ubuntu 24.04 machine:
#   curl -fsSL https://raw.githubusercontent.com/kylewrites33-cloud/story-forge/main/server/setup.sh | bash
# It asks for two keys (GitHub, Claude API), keeps them in /etc/story-forge/env (root only), installs git, Node 22
# and Claude Code, checks out the vault into /opt/story-forge/vault, and starts the runner as a service that comes
# back after a reboot. Nothing here is stored in any repository.
set -euo pipefail

VAULT_REPO="https://github.com/kylewrites33-cloud/author-business"
HOME_DIR=/opt/story-forge
VAULT="$HOME_DIR/vault"
ENV_FILE=/etc/story-forge/env

if [ "$(id -u)" != "0" ]; then echo "Run this as root (on the hosting company's console you already are)."; exit 1; fi

echo
echo "Sparrow runner setup"
echo "I need two keys. Paste each one and press Enter; nothing shows while you type."
echo
read -r -s -p "1) GitHub key for the vault (starts with github_pat_): " GH_TOKEN < /dev/tty; echo
read -r -s -p "2) Claude API key (starts with sk-ant-): " ANTHROPIC_KEY < /dev/tty; echo
if [ -z "$GH_TOKEN" ] || [ -z "$ANTHROPIC_KEY" ]; then echo "Both keys are needed. Run the command again."; exit 1; fi

echo "Installing git and Node 22..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates >/dev/null
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Installing Claude Code..."
npm install -g @anthropic-ai/claude-code >/dev/null 2>&1

id -u forge >/dev/null 2>&1 || useradd -r -m -d "$HOME_DIR" -s /bin/bash forge
mkdir -p "$HOME_DIR" /etc/story-forge
umask 077
cat > "$ENV_FILE" <<EOF
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
GITHUB_TOKEN=$GH_TOKEN
JOB_POLL_SECONDS=15
EOF
chmod 600 "$ENV_FILE"
umask 022

echo "Checking out the vault..."
if [ ! -d "$VAULT/.git" ]; then
  sudo -u forge git clone -q "https://x-access-token:${GH_TOKEN}@github.com/kylewrites33-cloud/author-business" "$VAULT"
else
  sudo -u forge git -C "$VAULT" remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/kylewrites33-cloud/author-business"
  sudo -u forge git -C "$VAULT" pull -q --rebase origin main || true
fi
sudo -u forge git -C "$VAULT" config user.name "Sparrow server"
sudo -u forge git -C "$VAULT" config user.email "server@users.noreply.github.com"

cat > /etc/systemd/system/story-forge-runner.service <<EOF
[Unit]
Description=Sparrow job runner
After=network-online.target
Wants=network-online.target

[Service]
User=forge
WorkingDirectory=$VAULT
EnvironmentFile=$ENV_FILE
Environment=HOME=$HOME_DIR
ExecStart=/usr/bin/node System/Tools/runner.mjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q story-forge-runner
systemctl restart story-forge-runner
sleep 3
echo
if systemctl is-active -q story-forge-runner; then
  echo "Done. The runner is on. Tell Claude in the Sparrow thread: \"server is up\"."
  echo "To see what it is doing later: journalctl -u story-forge-runner -f"
else
  echo "The runner did not start. Copy the lines below into the Sparrow thread:"
  journalctl -u story-forge-runner -n 20 --no-pager
fi
