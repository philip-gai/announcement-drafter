#!/bin/bash

echo "Starting probot app..."

echo "pwd:" $(pwd)
echo "ls:" $(ls)
echo "npm config get production:" $(npm config get production)

echo "npm cache clean --force..."
npm cache clean --force

# https://github.com/projectkudu/kudu/issues/2946#issuecomment-773546205
echo "npm rebuild..."
npm rebuild

echo "npm run start..."
npm run start
