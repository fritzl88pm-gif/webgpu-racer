#!/usr/bin/env bash
# Resolve current latest versions of the build dependencies.
set -u
for p in three vite typescript @types/three; do
  v=$(npm view "$p" version 2>/dev/null)
  echo "$p=$v"
done
