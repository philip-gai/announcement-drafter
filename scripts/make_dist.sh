#!/bin/bash

# Prequisites:
# npm install and npm build have already been run with NODE_ENV not set to production

rm -r dist
mkdir dist
cp -r lib dist/
find dist/lib ! -name "*.js" -type f -delete
cp package*.json dist/
cd dist
npm ci --production
npm cache clean --force
npm install
