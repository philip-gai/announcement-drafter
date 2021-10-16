#!/bin/bash

rm -r dist
mkdir dist
cp -r lib dist/
cp package*.json dist/
cd dist
npm ci --production
npm cache clean --force
npm install
