#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to fix common ESLint issues
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix unescaped quotes
  const quoteReplacements = [
    { from: /don't/g, to: "don&apos;t" },
    { from: /We're/g, to: "We&apos;re" },
    { from: /can't/g, to: "can&apos;t" },
    { from: /won't/g, to: "won&apos;t" },
    { from: /isn't/g, to: "isn&apos;t" },
    { from: /doesn't/g, to: "doesn&apos;t" },
    { from: /haven't/g, to: "haven&apos;t" },
    { from: /shouldn't/g, to: "shouldn&apos;t" },
    { from: /wouldn't/g, to: "wouldn&apos;t" },
    { from: /couldn't/g, to: "couldn&apos;t" },
    { from: /you're/g, to: "you&apos;re" },
    { from: /they're/g, to: "they&apos;re" },
    { from: /we're/g, to: "we&apos;re" },
    { from: /I'm/g, to: "I&apos;m" },
    { from: /it's/g, to: "it&apos;s" },
    { from: /that's/g, to: "that&apos;s" },
    { from: /what's/g, to: "what&apos;s" },
    { from: /here's/g, to: "here&apos;s" },
    { from: /there's/g, to: "there&apos;s" },
    { from: /let's/g, to: "let&apos;s" }
  ];

  // Apply quote fixes only in JSX content (between > and <)
  quoteReplacements.forEach(replacement => {
    const regex = new RegExp(`(>[^<]*?)${replacement.from.source}([^<]*?<)`, 'g');
    const newContent = content.replace(regex, `$1${replacement.to}$2`);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  });

  // Fix double quotes in JSX text
  content = content.replace(/(>[^<]*?)"([^"]*?)"([^<]*?<)/g, '$1&quot;$2&quot;$3');

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Get all TSX files
function getAllTsxFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// Fix all files
const files = getAllTsxFiles('./app');
files.push(...getAllTsxFiles('./components'));

files.forEach(fixFile);

console.log('ESLint fixes applied!');