#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../../backend" || { echo "Failed to change directory to backend"; exit 1; }

if ! command -v python3 >/dev/null 2>&1; then
	echo "Error: python3 not found. Install Python 3 and try again." >&2
	exit 1
fi

if [ -d "venv" ]; then
	echo "Found existing virtual environment at 'venv' — skipping creation."
else
	echo "Creating virtual environment..."
	if ! python3 -m venv venv 2>/tmp/venv_create_err; then
		echo "Failed to create virtual environment with 'python3 -m venv venv'." >&2
		echo ""
		if [ -f /tmp/venv_create_err ]; then
			cat /tmp/venv_create_err >&2
			if grep -qi ensurepip /tmp/venv_create_err || grep -qi 'ensurepip' /tmp/venv_create_err; then
				if [ -f /etc/debian_version ] || (grep -qi 'ubuntu' /etc/os-release 2>/dev/null || true); then
					echo "" >&2
					echo "On Debian/Ubuntu run: sudo apt install python3-venv" >&2
				else
					echo "Your Python lacks ensurepip; install the OS package that provides venv support." >&2
				fi
			fi
			rm -f /tmp/venv_create_err
		fi
		exit 1
	fi
fi

VENVPY="./venv/bin/python"
if [ ! -x "$VENVPY" ]; then
	echo "Error: virtualenv python ($VENVPY) not found or not executable." >&2
	exit 1
fi

echo "Installing dependencies using the virtual environment's pip..."
"$VENVPY" -m pip install --upgrade pip setuptools wheel
"$VENVPY" -m pip install -r requirements.txt

echo "Backend setup complete."
