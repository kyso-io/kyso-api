#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

echo "waiting kyso-api is up..."
sleep 5

MAX_WAIT=${MAX_WAIT:-110}
seconds=0
running=0

while [ $seconds -ne ${MAX_WAIT} ]; do

    http_code=$(curl -s -o /dev/null -w "%{http_code}" http://kyso-e2e-api:4000/api/v1/testing-data/populated)
    seconds=$((seconds + 1))
    echo "http_code: $http_code"
    sleep 1

    if [ $http_code -eq 200 ]; then
        echo "kyso-api is up"
        running=1
        break
    fi

done

if [ $running -eq 0 ]; then
    echo "kyso-api is not up"
    exit 1
fi

# Run the main container command.
exec newman "$@"
