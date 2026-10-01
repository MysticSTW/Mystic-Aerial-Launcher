const fs = require('fs')
const path = require('path')

const routesDir = path.join(__dirname, '..', 'src', 'routes')
const routeFilePattern = /\.(ts|tsx)$/i
const invalidPattern = /createRoute\(\s*['"`][^'"`]+['"`]\s*\)\s*\(\s*\{/g

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      results.push(...walk(fullPath))
      continue
    }

    if (entry.isFile() && routeFilePattern.test(entry.name)) {
      results.push(fullPath)
    }
  }

  return results
}

function getLineFromIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function toWorkspaceRelative(filePath) {
  return path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/')
}

function main() {
  if (!fs.existsSync(routesDir)) {
    console.error('Route syntax guard: src/routes not found.')
    process.exit(1)
  }

  const files = walk(routesDir)
  const failures = []

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8')
    const matches = [...content.matchAll(invalidPattern)]

    for (const match of matches) {
      failures.push({
        filePath: toWorkspaceRelative(filePath),
        line: getLineFromIndex(content, match.index || 0),
      })
    }
  }

  if (failures.length > 0) {
    console.error('Route syntax guard failed. Found incompatible createRoute declarations:')

    for (const failure of failures) {
      console.error(`- ${failure.filePath}:${failure.line}`)
    }

    console.error('Expected format: createRoute({ ... path: \'/your-path\' ... })')
    console.error('Do not use: createRoute(\'/your-path\')({ ... })')
    process.exit(1)
  }

  console.log('Route syntax guard passed.')
}

main()
