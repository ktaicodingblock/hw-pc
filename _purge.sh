#!/usr/bin/env bash

set -e

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cd "${SCRIPT_DIR}"


[ -x ./pc/_purge.sh ] && ./pc/_purge.sh
[ -x ./hw-control/_purge.sh ] && ./hw-control/_purge.sh
[ -x ./hw-proto/_purge.sh ] && ./hw-proto/_purge.sh

echo "`pwd` : rm -rf node_modules"
rm -rf node_modules
