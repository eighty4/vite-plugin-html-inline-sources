#!/bin/sh
set -e

FILE=$1
TAG=$2
VERSION=$3

DATE=$(date +%F)

sed -i \
  -e 's/## Unreleased/## Unreleased\n\n## '$VERSION' - '$DATE'/' \
  -e 's/\.\.\.HEAD/...'$TAG'/' \
  -e 's/\[Unreleased\]/[Unreleased]: https:\/\/github.com\/eighty4\/vite-plugin-html-inline-sources\/compare\/'$TAG'...HEAD\n['$VERSION']/' \
  "$FILE"
