#!/bin/bash

# Prequisites:
# 1. npm install and npm build:dev have already been run with NODE_ENV not set to production
# NOTE: No need to run npm install, this is handled by Oryx build when SCM_DO_BUILD_DURING_DEPLOYMENT is set to true
# https://github.com/microsoft/Oryx/blob/main/doc/runtimes/nodejs.md#build

# Exit immediately if a command exits with a non-zero status.
set -e

echo "Creating dist folder."
rm -rf dist
mkdir dist

echo "Copying lib output to dist folder."
cp -r lib dist/

echo "Removing all non-js files."
find dist/lib ! -name "*.js" -type f -delete

echo "Copying package*.json files to dist folder."
cp package*.json dist/
