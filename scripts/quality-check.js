#!/usr/bin/env node

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

console.log('🔍 Running comprehensive code quality checks...\n')

const checks = [
  {
    name: 'TypeScript Type Check',
    command: 'pnpm typecheck',
    description: 'Checking TypeScript compilation',
  },
  {
    name: 'ESLint Check',
    command: 'pnpm lint',
    description: 'Running ESLint',
  },
  {
    name: 'Prettier Format Check',
    command: 'pnpm format --check',
    description: 'Checking code formatting',
  },
  {
    name: 'Unit Tests',
    command: 'pnpm test:run',
    description: 'Running unit tests',
  },
  {
    name: 'Build Check',
    command: 'pnpm build',
    description: 'Building project',
  },
]

let allPassed = true

for (const check of checks) {
  console.log(`📋 ${check.name}`)
  console.log(`   ${check.description}...`)

  try {
    const startTime = Date.now()
    execSync(check.command, { stdio: 'inherit' })
    const duration = Date.now() - startTime
    console.log(`   ✅ Passed (${duration}ms)\n`)
  } catch (error) {
    console.log(`   ❌ Failed\n`)
    allPassed = false
  }
}

if (allPassed) {
  console.log('🎉 All code quality checks passed!')
  process.exit(0)
} else {
  console.log('❌ Some checks failed. Please fix the issues above.')
  process.exit(1)
}
