#!/bin/bash
# Script to enable slash-up command syncing on Heroku by fixing https://github.com/Snazzah/slash-up/issues/189

set -euox pipefail

timeout -v 30 npx -y slash-up sync || ([[ $? -eq 124 ]] && echo "Sync timed out, assuming completed")
