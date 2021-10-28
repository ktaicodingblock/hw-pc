#!/usr/bin/env bash

set -e

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cd ${SCRIPT_DIR}

echo "git pull && git submodule update --init"
git pull && git submodule update --init

# for f in sub/*; do
#     (cd $f && git checkout master && git pull)
# done