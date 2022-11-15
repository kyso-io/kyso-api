#!/bin/sh
set -e
_branch="$(git branch --show-current 2>/dev/null)" || true
_commit="$(git rev-parse HEAD 2>/dev/null)" || true
if [ "$_branch" ] && [ "$_commit" ]; then
  _build_date="$(date -R)"
  _tag="$(git describe --tags "$_commit" 2>/dev/null)" || true
  if [ "$(git status --porcelain)" ]; then
    _commit="$_commit (dirty)"
  fi
  _ref_type="Branch and Tag"
  _git_ref="$_branch<br />$_tag"
  [ -d "dist/public" ] || mkdir -p "dist/public"
  sed \
    -e "s%__BUILD_DATE__%$_build_date%g" \
    -e "s%__GIT_SHA__%$_commit%g" \
    -e "s%__REF_TYPE__%$_ref_type%g" \
    -e "s%__GIT_REF__%$_git_ref%g" \
    public/v.html > dist/public/v.html
fi
