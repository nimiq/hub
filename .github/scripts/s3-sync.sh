#!/bin/bash

# Uploads dist/ to S3 with an explicit content type per file type, then prunes objects that are no
# longer part of the build.
#
# Usage: S3_BUCKET=... [MAX_PRUNE=n] .github/scripts/s3-sync.sh
#
# The two halves belong together: the prune pass is what proves the upload passes were complete.
# It re-runs the sync with --size-only and must upload nothing; anything it wants to send is a file
# that escaped the typed passes and would otherwise land with a guessed content type. The origin
# sends `nosniff`, so a wrong content type is a hard failure in the browser, not a cosmetic one.
#
# tools/distValidator.js enforces the same allowlist against dist/ before any credentials are
# requested, so this is the second of two gates, not the first.

# Exit on error
set -eu
set -o pipefail

: "${S3_BUCKET:?S3_BUCKET is not set}"

DEST="s3://${S3_BUCKET}/"

# The prune below deletes everything under the bucket root that is not part of this build, so a
# bucket that holds anything else loses it. Two guards, because head-bucket only proves the bucket
# exists and is reachable, not that it is the right one:
#
# A bucket with objects but no index.html at its root was never a Hub deployment, which is what a
# mistyped or stale S3_BUCKET looks like. An empty bucket is fine -- that is a first deploy.
first_key=$(aws s3api list-objects-v2 --bucket "$S3_BUCKET" --max-keys 1 \
              --query 'Contents[0].Key' --output text)
if [ "$first_key" != "None" ] \
   && ! aws s3api head-object --bucket "$S3_BUCKET" --key index.html >/dev/null 2>&1; then
    echo "::error::$S3_BUCKET holds objects but no index.html at its root, so it is not a Hub"\
         "deployment. Refusing to sync, because the prune would delete whatever is in there."
    exit 1
fi

# And a ceiling on how much one deploy may delete. A fixed number is the wrong shape for the Hub:
# webpack content-hashes ~590 files per build, so a release that only touches a view prunes a
# couple of dozen objects while a dependency bump rebundles and prunes almost all of them, and both
# are normal. What is not normal is a deploy that removes more than it puts back -- that is a
# half-built dist/ or the wrong bucket -- so the default ceiling is this build's own file count.
MAX_PRUNE="${MAX_PRUNE:-$(find dist -type f | wc -l)}"

# Matches the nginx deployment on testnet-web1, which serves everything `no-cache,
# must-revalidate`. CloudFront still serves from the edge; it just revalidates via ETag. Switching
# the content-hashed bundles under js/ and css/ to `immutable` is a worthwhile follow-up, but is a
# behaviour change and should land as its own revertible commit rather than riding along with the
# origin move.
CACHE="no-cache, must-revalidate"

# $1=content-type  $2...=filters
put() {
    local ct="$1"
    shift
    aws s3 sync dist/ "$DEST" --no-progress --exclude "*" "$@" \
        --content-type "$ct" --cache-control "$CACHE"
}

put "application/javascript; charset=utf-8" --include "*.js" --include "*.mjs"
put "text/css; charset=utf-8"               --include "*.css"
put "application/wasm"                      --include "*.wasm"
put "image/svg+xml"                         --include "*.svg"
put "image/png"                             --include "*.png"
put "image/x-icon"                          --include "*.ico"
put "video/mp4"                             --include "*.mp4"
# *.json covers build-info.json, written by the workflow just before this runs, and the
# package.json that rides along with the copied-in @nimiq/core.
put "application/json"                      --include "*.map" --include "*.json"
# vue.config.js copies @nimiq/core in whole, which brings its README and its .d.ts files along.
# Nothing fetches them; they are served as text so that `nosniff` cannot turn one into a surprise.
# In particular .ts must not go out as video/mp2t, which is what its registered type is.
put "text/markdown; charset=utf-8"          --include "*.md"
put "text/plain; charset=utf-8"             --include "*.ts" --include "*.gitkeep" \
                                            --include "*/LICENSE"

# HTML last -- this is the commit point; it carries the SRI hashes that pin every bundle uploaded
# above.
put "text/html; charset=utf-8" --include "*.html"

# One dryrun answers both remaining questions: what did the typed passes miss, and how much is
# the prune about to remove. --size-only here means "don't re-upload": everything already went up
# with the correct metadata, so this pass must upload NOTHING.
plan=$(aws s3 sync dist/ "$DEST" --delete --size-only --dryrun --no-progress)

extra=$(echo "$plan" | grep '^(dryrun) upload:' || true)
if [ -n "$extra" ]; then
    echo "$extra"
    echo "::error::files above were not covered by a typed upload pass"
    exit 1
fi

deletions=$(echo "$plan" | grep '^(dryrun) delete:' || true)
prune_count=0
if [ -n "$deletions" ]; then
    echo "$deletions"
    prune_count=$(echo "$deletions" | wc -l)
fi
echo "pruning $prune_count stale object(s) from $DEST"

if [ "$prune_count" -gt "$MAX_PRUNE" ]; then
    echo "::error::refusing to delete $prune_count objects, which is more than MAX_PRUNE"\
         "($MAX_PRUNE). Check that $S3_BUCKET is the intended bucket; if it is, re-run with a"\
         "higher MAX_PRUNE."
    exit 1
fi

aws s3 sync dist/ "$DEST" --delete --size-only --no-progress
