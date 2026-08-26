/**
 * Protected — 보호 경로가 승인 없이 바뀌었는지 검사한다.
 *
 * 원본: docs/harness/01-ssot.md §6 "보호 경로와 승인"
 *
 * 승인된 내용 해시(scripts/verify/protected.json)와 현재 내용을 대조한다.
 * 다르면 실패한다. 사람이 `npm run verify:approve` 로 승인하면 기록이 갱신되고,
 * 그 기록은 커밋되므로 CI 에서도 같은 결과가 나온다.
 */
import { currentHashes, readManifest } from './protected-manifest'

const manifest = readManifest()

if (!manifest) {
  console.error('\n❌ Protected 실패 — 승인 기록이 없습니다\n')
  console.error('  최초 승인이 필요합니다:')
  console.error('    npm run verify:approve -- "최초 기준선"\n')
  process.exit(1)
}

const current = currentHashes()
const approved = manifest.paths

const changed: string[] = []
const added: string[] = []
const removed: string[] = []

for (const [file, h] of Object.entries(current)) {
  if (!(file in approved)) added.push(file)
  else if (h === '') removed.push(file)
  else if (approved[file] !== h) changed.push(file)
}
for (const file of Object.keys(approved)) {
  if (!(file in current)) removed.push(file)
}

const total = changed.length + added.length + removed.length

if (total > 0) {
  console.error(`\n❌ Protected 실패 — 승인되지 않은 보호 경로 변경 ${total}건\n`)
  for (const f of changed) console.error(`  변경  ${f}`)
  for (const f of added) console.error(`  추가  ${f}`)
  for (const f of removed) console.error(`  삭제  ${f}`)
  console.error('\n보호 경로는 사람이 승인해야 바뀐다 (docs/harness/01-ssot.md §6).')
  console.error('의도한 변경이면 승인한다:')
  console.error('    npm run verify:approve -- "왜 바꾸는지"')
  console.error('의도한 변경이 아니면 되돌린다:')
  console.error('    git checkout -- <경로>\n')
  process.exit(1)
}

console.log(
  `✅ Protected — 보호 경로 ${Object.keys(approved).length}개가 승인된 상태와 같다` +
    ` (승인: ${manifest.approvedBy}, ${manifest.approvedAt.slice(0, 10)})`
)
