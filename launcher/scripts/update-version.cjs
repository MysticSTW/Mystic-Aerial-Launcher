#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

// Parse current version
const [major, minor, patch] = packageData.version.split('.').map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;
packageData.version = newVersion;

// Write updated package.json
fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');

console.log(`✓ Version updated: ${newVersion}`);
