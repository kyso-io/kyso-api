#!/bin/sh
# vim:ts=2:sw=2:et:ai:sts=2

set -e

# Relative PATH to the workdir from this script (usually . or .., empty means .)
RELPATH_TO_WORKDIR=".."

# Variables
IMAGE_NAME="k3d-registry.lo.kyso.io:5000/kyso-api"
IMAGE_TAG="latest"
CONTAINER_NAME="kyso-api"
BUILD_ARGS=""
BUILD_SECRETS=""
BUILD_TAG="$IMAGE_NAME:$IMAGE_TAG"
MONGODB_IMAGE="bitnami/mongodb:4.4.11-debian-10-r12"
NPMRC_KYSO=".npmrc.kyso"
NPMRC_DOCKER=".npmrc.docker"
ENV_DOCKER=".env.docker"
CONTAINER_VARS=""
PUBLISH_PORTS="--publish 127.0.0.1:4000:4000"
VERSION_UPDATE="./bin/version-update.sh"

# ---------
# FUNCTIONS
# ---------

# POSIX compliant version of readlinkf (MacOS does not have coreutils) copied
# from https://github.com/ko1nksm/readlinkf/blob/master/readlinkf.sh
_readlinkf_posix() {
  [ "${1:-}" ] || return 1
  max_symlinks=40
  CDPATH='' # to avoid changing to an unexpected directory
  target=$1
  [ -e "${target%/}" ] || target=${1%"${1##*[!/]}"} # trim trailing slashes
  [ -d "${target:-/}" ] && target="$target/"
  cd -P . 2>/dev/null || return 1
  while [ "$max_symlinks" -ge 0 ] && max_symlinks=$((max_symlinks - 1)); do
    if [ ! "$target" = "${target%/*}" ]; then
      case $target in
      /*) cd -P "${target%/*}/" 2>/dev/null || break ;;
      *) cd -P "./${target%/*}" 2>/dev/null || break ;;
      esac
      target=${target##*/}
    fi
    if [ ! -L "$target" ]; then
      target="${PWD%/}${target:+/}${target}"
      printf '%s\n' "${target:-/}"
      return 0
    fi
    # `ls -dl` format: "%s %u %s %s %u %s %s -> %s\n",
    #   <file mode>, <number of links>, <owner name>, <group name>,
    #   <size>, <date and time>, <pathname of link>, <contents of link>
    # https://pubs.opengroup.org/onlinepubs/9699919799/utilities/ls.html
    link=$(ls -dl -- "$target" 2>/dev/null) || break
    target=${link#*" $target -> "}
  done
  return 1
}

# Change to working directory (script dir + the value of RELPATH_TO_WORKDIR)
cd_to_workdir() {
  _script="$(_readlinkf_posix "$0")"
  _script_dir="${_script%/*}"
  if [ "$RELPATH_TO_WORKDIR" ]; then
    cd "$(_readlinkf_posix "$_script_dir/$RELPATH_TO_WORKDIR")"
  else
    cd "$_script_dir"
  fi
}

docker_setup() {
  if [ ! -f "$NPMRC_KYSO" ]; then
    PACKAGE_READER_TOKEN=""
    echo "Please, create a personal access token with read_api scope"
    echo "URL: https://gitlab.kyso.io/-/profile/personal_access_tokens"
    while [ -z "$PACKAGE_READER_TOKEN" ]; do
      printf "Token value: "
      read -r PACKAGE_READER_TOKEN
    done
    cat >"$NPMRC_KYSO" <<EOF

@kyso-io:registry=https://gitlab.kyso.io/api/v4/packages/npm/
//gitlab.kyso.io/api/v4/packages/npm/:_authToken=${PACKAGE_READER_TOKEN}
EOF
  fi
  if [ ! -f "$ENV_DOCKER" ]; then
    echo "Copying the sample ./.env file to $ENV_DOCKER"
    cp "./.env" "$ENV_DOCKER"
    echo "Adjust values for your setup!!!"
  fi
}

docker_build() {
  if [ ! -f "./.npmrc.kyso" ]; then
    echo "Missing file '.npmrc.kyso', call $0 init to create it"
    exit 1
  fi
  # Prepare .npmrc.docker
  cat ".npmrc" "$NPMRC_KYSO" >"$NPMRC_DOCKER"
  # Compute build args
  if [ -f "./.build-args" ]; then
    BUILD_ARGS="$(
      awk '!/^#/ { printf(" --build-arg \"%s\"", $0); }' "./.build-args"
    )"
  fi
  # Compute build secrets if there is a .build_secrets file
  if [ -f "./.build-secrets" ]; then
    BUILD_SECRETS="$(
      awk -f- "./.build-secrets" <<EOF
!/^#/{
  sub("src=.npmrc","src=$NPMRC_DOCKER",\$0);
  printf(" --secret \"%s\"", \$0);
}
EOF
    )"
  fi
  # Update version file
  $VERSION_UPDATE
  DOCKER_COMMAND="$(
    printf "%s" \
      "DOCKER_BUILDKIT=1 docker build${BUILD_ARGS}${BUILD_SECRETS}" \
      " --tag '$BUILD_TAG' ."
  )"
  eval "$DOCKER_COMMAND"
}

docker_build_prune() {
  DOCKER_BUILDKIT=1 docker builder prune -af
}

push_lo() {
  docker push "$BUILD_TAG"
}

docker_epsh() {
  if [ "$(docker_status)" ]; then
    docker rm "$CONTAINER_NAME"
  fi
  VOLUMES="-v $(pwd)/$ENV_DOCKER:/app/.env"
  DOCKER_COMMAND="$(
    printf "%s" \
      "docker run --entrypoint '/bin/sh' --rm -ti --name '$CONTAINER_NAME'" \
      " $VOLUMES '$BUILD_TAG'"
  )"
  eval "$DOCKER_COMMAND"
}

docker_logs() {
  docker logs "$@" "$CONTAINER_NAME"
}

docker_rm() {
  docker rm "$CONTAINER_NAME"
}

docker_run() {
  if [ "$(docker_status)" ]; then
    docker rm "$CONTAINER_NAME"
  fi
  VOLUMES="-v $(pwd)/$ENV_DOCKER:/app/.env"
  DOCKER_COMMAND="$(
    printf "%s" \
      "docker run -d --name '$CONTAINER_NAME' $CONTAINER_VARS $PUBLISH_PORTS" \
      " $VOLUMES '$BUILD_TAG'"
  )"
  eval "$DOCKER_COMMAND"
}

docker_sh() {
  docker exec -ti "$CONTAINER_NAME" /bin/sh
}

docker_status() {
  docker ps -a -f name="^${CONTAINER_NAME}$" --format '{{.Status}}' \
    2>/dev/null || true
}

docker_stop() {
  docker stop "$CONTAINER_NAME"
  docker rm "$CONTAINER_NAME"
}

mongo() {
  docker run --rm -ti --name mongo "$MONGODB_IMAGE" /bin/bash
}

usage() {
  cat <<EOF
Usage: $0 CMND [ARGS]

Where CMND can be one of:
- setup: prepare local files (.npmrc.kyso & .env.docker)
- build: create container
- build-prune: cleanup builder caché
- start: launch container in daemon mode with the right settings
- stop|status|rm|logs: operations on the container
- sh: execute interactive shell (/bin/sh) on the running container
- epsh: launch container using /bin/sh as entrypoint
- mongo: launch interactive container with the mongo client installed
EOF
}

# ----
# MAIN
# ----

cd_to_workdir
echo "WORKING DIRECTORY = '$(pwd)'"
echo ""

case "$1" in
build) docker_build ;;
build-prune) docker_build_prune ;;
push) push_lo ;;
epsh) docker_epsh ;;
logs) shift && docker_logs "$@" ;;
rm) docker_rm ;;
setup) docker_setup ;;
sh) docker_sh ;;
start) docker_run ;;
status) docker_status ;;
stop) docker_stop ;;
mongo) mongo ;;
*) usage ;;
esac
