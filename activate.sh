#!/usr/bin/env bash

if [ -n "${BASH_VERSION:-}" ]; then
    if [ "${BASH_SOURCE[0]}" = "$0" ]; then
        echo "Please source this script: source ./activate.sh" >&2
        exit 1
    fi
    _activate_source="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then
    if [[ "${ZSH_EVAL_CONTEXT:-}" != *:file ]]; then
        echo "Please source this script: source ./activate.sh" >&2
        exit 1
    fi
    eval '_activate_source="${(%):-%N}"'
else
    echo "This script requires bash or zsh." >&2
    return 1 2>/dev/null || exit 1
fi

echo "------------------------------"
echo "[     activating project     ]"
echo "------------------------------"

SCRIPT_DIR=$(cd "$(dirname "$_activate_source")" && pwd) || return 1
PROJECT_ROOT_FOLDER="$SCRIPT_DIR"
export PROJECT_ROOT_FOLDER

if command -v python3 >/dev/null 2>&1; then
    _activate_python=python3
elif command -v python >/dev/null 2>&1; then
    _activate_python=python
else
    echo "Could not find python3 or python." >&2
    return 1
fi

if [ ! -d "$PROJECT_ROOT_FOLDER/venv" ]; then
    echo "creating python virtual environment..."
    "$_activate_python" -m venv "$PROJECT_ROOT_FOLDER/venv" || return 1
fi

echo "activating python environment..."
if [ ! -f "$PROJECT_ROOT_FOLDER/venv/bin/activate" ]; then
    echo "could not find venv activation script." >&2
    return 1
fi
. "$PROJECT_ROOT_FOLDER/venv/bin/activate" || return 1

echo "checking python packages..."
python -m pip install -r "$PROJECT_ROOT_FOLDER/requirements.txt" \
    --disable-pip-version-check -q --index-url https://pypi.org/simple || return 1

echo "setting environment variables..."
if [ ! -f "$PROJECT_ROOT_FOLDER/planetraves.env" ]; then
    echo "could not find environment file: $PROJECT_ROOT_FOLDER/planetraves.env" >&2
    return 1
fi

while IFS= read -r _activate_line || [ -n "$_activate_line" ]; do
    _activate_line=${_activate_line%$'\r'}
    case "$_activate_line" in
        ''|\#*) continue ;;
        *=*)
            _activate_key=${_activate_line%%=*}
            _activate_value=${_activate_line#*=}
            export "$_activate_key=$_activate_value" || return 1
            ;;
    esac
done < "$PROJECT_ROOT_FOLDER/planetraves.env"

_activate_token_file="$HOME/.supabase/planetraves.token"
if [ -f "$_activate_token_file" ]; then
    IFS= read -r SUPABASE_ACCESS_TOKEN < "$_activate_token_file"
    export SUPABASE_ACCESS_TOKEN
else
    echo "WARNING: token file not found: $_activate_token_file"
fi

echo "SUCCESS"
