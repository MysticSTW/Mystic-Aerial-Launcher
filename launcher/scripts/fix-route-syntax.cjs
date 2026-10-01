const fs = require('fs')
const path = require('path')

const routesDir = path.join(__dirname, '..', 'src', 'routes')
const routeFilePattern = /\.(ts|tsx)$/i
const replacePattern = /createRoute\(\s*['"`][^'"`]+['"`]\s*\)\s*\(\s*\{/g

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

function toWorkspaceRelative(filePath) {
  return path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/')
}

function main() {
  if (!fs.existsSync(routesDir)) {
    console.error('Route syntax fixer: src/routes not found.')
    process.exit(1)
  }

  const files = walk(routesDir)
  const changed = []

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, 'utf8')
    const updated = original.replace(replacePattern, 'createRoute({')

    if (updated !== original) {
      fs.writeFileSync(filePath, updated, 'utf8')
      changed.push(toWorkspaceRelative(filePath))
    }
  }

  if (changed.length > 0) {
    console.log(`Route syntax fixer updated ${changed.length} file(s):`)
    for (const file of changed) {
      console.log(`- ${file}`)
    }
  } else {
    console.log('Route syntax fixer: no changes needed.')
  }
}

main()
