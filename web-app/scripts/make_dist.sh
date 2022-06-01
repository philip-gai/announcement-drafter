#!/bin/bash

# Prequisites:
# npm install and npm build have already been run with NODE_ENV not set to production

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

# Startup command that will be run as part of container startup
echo "Copying startup.sh to dist/scripts folder."
mkdir dist/scripts && cp scripts/startup.sh dist/scripts/

echo "Installing the node modules in the dist folder."
cd dist
npm ci --production
npm cache clean --force
npm install
