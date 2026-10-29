#!/bin/sh
# Netlify's "ignore" check (netlify.toml): exit 0 skips the deploy, anything else builds.
# Each production deploy costs Netlify credits, so commits that only change the Cloud
# Functions, the README or the GitHub workflows (deployed by GitHub Actions) don't use one.
# First, manual or retried deploys always build.
[ -z "$CACHED_COMMIT_REF" ] && exit 1
[ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ] && exit 1
git cat-file -e "$CACHED_COMMIT_REF^{commit}" 2>/dev/null || exit 1
git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- src public index.html admin.html equipo.html package.json package-lock.json vite.config.js netlify.toml .env scripts
