/**
 * 보호 경로 변경 승인 — 사람이 실행한다.
 *
 * 원본: docs/harness/01-ssot.md §6 "보호 경로와 승인"
 *
 *   npm run verify:approve -- --scope <경로> "왜 바꾸는지"
 *
 * 사람이 지정한 **범위의 경로만** 기준선으로 기록한다.
 * 범위를 빠뜨리면 승인하지 않는다 — 무엇을 승인하는지는 사람이 지정한다.
 * 범위 밖에 남은 변경은 승인되지 않은 채로 남아 Protected 에서 계속 걸린다.
 *
 * 기록은 커밋되어야 CI 에서도 통과한다.
 * AI 는 이 명령을 사람의 요청 없이 실행하지 않는다.
 *
 * 보호 경로 변경이 없어도 사유만 고쳐 적을 수 있다.
 * 사유를 빠뜨린 승인을 나중에 메울 수 있어야 하기 때문이다 — 해시는 건드리지 않는다.
 */
import { execSync } from 'node:child_process'
import {
  currentHashes,
  diffAgainst,
  knownPaths,
  MANIFEST_NOTE,
  readManifest,
  resolveScope,
  writeManifest,
  type Manifest,
} from './protected-manifest'

const argv = process.argv.slice(2)
const scopeSpecs: string[] = []
const words: string[] = []

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (arg === '--scope' || arg === '-s') {
    const value = argv[++i]
    if (value === undefined) {
      console.error('\n❌ --scope 뒤에 경로가 없습니다\n')
      process.exit(1)
    }
    scopeSpecs.push(...value.split(','))
  } else if (arg.startsWith('--scope=')) {
    scopeSpecs.push(...arg.slice('--scope='.length).split(','))
  } else {
    words.push(arg)
  }
}

const reason = words.join(' ').trim()

function gitUser(): string {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim()
    const email = execSync('git config user.email', { encoding: 'utf8' }).trim()
    return email ? `${name} <${email}>` : name
  } catch {
    return '알 수 없음'
  }
}

const manifest: Manifest = readManifest() ?? { note: MANIFEST_NOTE, paths: {} }
const current = currentHashes()
const known = knownPaths(manifest)
const pending = diffAgainst(manifest, current)
const pendingAll = [...pending.changed, ...pending.added, ...pending.removed].sort()

// 무엇을 승인하는지는 사람이 지정한다. 지정이 없으면 아무것도 승인하지 않는다
if (scopeSpecs.length === 0) {
  console.error('\n❌ --scope 가 필요합니다 — 무엇을 승인하는지 사람이 지정해야 한다\n')
  console.error('    npm run verify:approve -- --scope <경로> "왜 바꾸는지"\n')
  if (pendingAll.length > 0) {
    console.error('  지금 승인되지 않은 보호 경로 변경:\n')
    for (const f of pending.changed) console.error(`    변경  ${f}`)
    for (const f of pending.added) console.error(`    추가  ${f}`)
    for (const f of pending.removed) console.error(`    삭제  ${f}`)
    console.error('\n  의도한 것만 골라 지정한다. 디렉터리는 끝에 / 를 붙인다 (예: scripts/verify/)\n')
  } else {
    console.error('  지금 승인되지 않은 보호 경로 변경은 없습니다.')
    console.error('  사유만 고쳐 적으려면 그 경로를 범위로 지정한다\n')
  }
  process.exit(1)
}

const { files: scope, exact, unknown } = resolveScope(scopeSpecs, known)

if (unknown.length > 0) {
  console.error('\n❌ 보호 경로가 아니거나 존재하지 않는 범위입니다\n')
  for (const s of unknown) console.error(`    ${s}`)
  console.error('\n  지정할 수 있는 경로:\n')
  for (const f of known) console.error(`    ${f}`)
  console.error('')
  process.exit(1)
}

const inScope = new Set(scope)
const approvedNow: string[] = []
const addedNow: string[] = []
const removedNow: string[] = []
const reasonOnly: string[] = []

for (const file of scope) {
  const hash = current[file] ?? ''
  const before = manifest.paths[file]

  if (hash === '') {
    // 삭제를 승인한다 — 기록에서 뺀다
    if (before) {
      delete manifest.paths[file]
      removedNow.push(file)
    }
    continue
  }

  if (!before) {
    manifest.paths[file] = { hash, approvedAt: new Date().toISOString(), approvedBy: gitUser(), reason: reason || '(사유 미기재)' }
    addedNow.push(file)
    continue
  }

  if (before.hash === hash) {
    // 승인할 내용은 그대로고 사유만 채우는 경우.
    // 해시를 다시 계산하지 않는다 — 무엇을 승인했는지는 바뀌지 않고, 기록의 '왜'만 채운다.
    // 사람이 경로를 그대로 짚었을 때만 메운다 — 디렉터리로 쓸어 담은 김에 남의 사유를 덮지 않는다
    if (exact.has(file) && reason && reason !== before.reason) {
      manifest.paths[file] = { ...before, approvedAt: new Date().toISOString(), approvedBy: gitUser(), reason }
      reasonOnly.push(file)
    }
    continue
  }

  manifest.paths[file] = { hash, approvedAt: new Date().toISOString(), approvedBy: gitUser(), reason: reason || '(사유 미기재)' }
  approvedNow.push(file)
}

const touched = approvedNow.length + addedNow.length + removedNow.length

if (touched === 0 && reasonOnly.length === 0) {
  console.log('\n승인할 변경이 없습니다 — 지정한 범위는 이미 기준선과 같습니다\n')
  for (const f of scope) console.log(`  그대로  ${f}`)
  if (!reason) console.log('\n사유만 고쳐 적으려면: npm run verify:approve -- --scope <경로> "왜 바꾸는지"')
  console.log('')
} else {
  writeManifest(manifest)

  if (touched > 0) {
    console.log('\n▸ 다음 범위만 승인합니다\n')
    for (const f of approvedNow) console.log(`  변경  ${f}`)
    for (const f of addedNow) console.log(`  추가  ${f}`)
    for (const f of removedNow) console.log(`  삭제  ${f}`)
    console.log(`\n  사유: ${reason || '(사유 미기재)'}`)
  }

  if (reasonOnly.length > 0) {
    console.log('\n▸ 사유만 갱신 — 승인된 내용은 그대로입니다\n')
    for (const f of reasonOnly) console.log(`  사유  ${f}`)
    console.log(`\n  사유: ${reason}`)
  }

  console.log('\n이 기록을 함께 커밋해야 CI 에서도 통과합니다\n')
}

// 범위 밖에 남은 변경은 승인되지 않았다. 조용히 통과했다고 착각하지 않게 여기서 말한다
const left = pendingAll.filter((f) => !inScope.has(f))
if (left.length > 0) {
  console.warn(`⚠️  승인 범위 밖에 변경 ${left.length}건이 남아 있습니다 — Protected 에서 계속 걸립니다\n`)
  for (const f of left) console.warn(`  ${f}`)
  console.warn('\n의도한 변경이면 그 경로를 범위로 지정해 승인한다.')
  console.warn('의도한 변경이 아니면 되돌린다:  git checkout -- <경로>\n')
}
