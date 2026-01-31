#!/usr/bin/env bash
set -euo pipefail

print() {
  printf '%s\n' "$*"
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

install_cli=true
for arg in "$@"; do
  case "$arg" in
    --no-install)
      install_cli=false
      ;;
    -h|--help)
      print "Usage: bash setup.sh [--no-install]"
      print ""
      print "  --no-install  Skip Bun/dependency/global install; only set env vars."
      exit 0
      ;;
    *)
      print "ERROR: Unknown option: $arg"
      print "Run: bash setup.sh --help"
      exit 1
      ;;
  esac
done

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    return 0
  fi

  print "Bun not found. Installing..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://bun.sh/install | bash
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- https://bun.sh/install | bash
  else
    print "ERROR: curl or wget is required to install Bun."
    exit 1
  fi

  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1; then
    print "ERROR: Bun installed but not on PATH."
    print "Open a new terminal or run: export PATH=\"$HOME/.bun/bin:$PATH\""
    exit 1
  fi

  print "Bun installed."
}

confirm() {
  local prompt="$1"
  local response=""
  printf '%s' "$prompt"
  IFS= read -r response
  case "$response" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

prompt_non_empty() {
  local label="$1"
  local __resultvar="$2"
  local value=""
  while [ -z "$value" ]; do
    printf '%s: ' "$label"
    IFS= read -r value
    if [ -z "$value" ]; then
      print "Value required."
    fi
  done
  printf -v "$__resultvar" '%s' "$value"
}

prompt_secret() {
  local label="$1"
  local __resultvar="$2"
  local value=""
  while [ -z "$value" ]; do
    printf '%s: ' "$label"
    IFS= read -r -s value
    printf '\n'
    if [ -z "$value" ]; then
      print "Value required."
    fi
  done
  printf -v "$__resultvar" '%s' "$value"
}

escape_env() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

default_profile="$HOME/.profile"
if [ -n "${SHELL:-}" ]; then
  case "$SHELL" in
    */zsh) default_profile="$HOME/.zshrc" ;;
    */bash)
      if [ -f "$HOME/.bashrc" ]; then
        default_profile="$HOME/.bashrc"
      else
        default_profile="$HOME/.bash_profile"
      fi
      ;;
  esac
fi

print "Jenkins CLI setup"
print "This will prompt for Jenkins credentials."
print ""

if [ "$install_cli" = true ]; then
  ensure_bun

  if [ ! -f "$script_dir/package.json" ]; then
    print "ERROR: package.json not found. Run this script from the project root."
    exit 1
  fi

  print "Installing dependencies..."
  bun install

  print "Installing Jenkins CLI globally..."
  bun run install:global
else
  print "Skipping install steps."
fi

prompt_non_empty "Jenkins URL (e.g., https://jenkins.example.com)" JENKINS_URL
prompt_non_empty "Jenkins username" JENKINS_USER
prompt_secret "Jenkins API token" JENKINS_API_TOKEN

env_file="$HOME/.jenkins-cli-env"

if confirm "Save values to $env_file? [y/N]: "; then
  old_umask=$(umask)
  umask 077
  cat > "$env_file" <<EOF
# Jenkins CLI environment
export JENKINS_URL="$(escape_env "$JENKINS_URL")"
export JENKINS_USER="$(escape_env "$JENKINS_USER")"
export JENKINS_API_TOKEN="$(escape_env "$JENKINS_API_TOKEN")"
EOF
  umask "$old_umask"
  chmod 600 "$env_file" 2>/dev/null || true
  print "Saved to $env_file."

  if confirm "Load it automatically by updating $default_profile? [y/N]: "; then
    profile="$default_profile"
    printf 'Profile file to update [%s]: ' "$default_profile"
    IFS= read -r profile_input
    if [ -n "$profile_input" ]; then
      profile="$profile_input"
    fi

    touch "$profile"
    if grep -q "# jenkins-cli env" "$profile" 2>/dev/null; then
      print "Profile already references the Jenkins CLI env file."
    else
      cat >> "$profile" <<EOF

# jenkins-cli env
[ -f "$env_file" ] && . "$env_file"
# end jenkins-cli env
EOF
      print "Updated $profile."
    fi

    print "Open a new terminal or run: . \"$profile\""
  else
    print "To load for the current shell: . \"$env_file\""
  fi
else
  print "Not saved. Re-run this script anytime to store values."
fi
