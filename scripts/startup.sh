#!/bin/bash

echo "Starting probot app..."

echo "pwd:" $(pwd)
echo "ls:" $(ls)
echo "npm config get production:" $(npm config get production)
echo "npm rebuild..."
npm rebuild
echo "npm run start..."
npm run start
