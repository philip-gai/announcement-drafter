#!/bin/bash

# Prequisites:
# npm install and npm build have already been run with NODE_ENV not set to production

# Exit immediately if a command exits with a non-zero status.
set -e

rm -rf dist
mkdir dist
cp -r lib dist/

# Remove all non-js files
find dist/lib ! -name "*.js" -type f -delete

cp package*.json dist/

# Startup command that will be run as part of container startup
cp scripts/startup.sh dist/

# Install node modules in the dist folder
# devDependencies are still needed here
cd dist
npm ci --production
