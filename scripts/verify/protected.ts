/**
 * Protected — 보호 경로가 승인 없이 바뀌었는지 검사한다.
 *
 * 원본: docs/harness/01-ssot.md §6 "보호 경로와 승인"
 *
 * 승인된 내용 해시(scripts/verify/protected.json)와 현재 내용을 대조한다.
 * 다르면 실패한다. 사람이 `npm run verify:approve -- --scope <경로>` 로 승인하면
 * 지정한 경로의 기록만 갱신되고, 그 기록은 커밋되므로 CI 에서도 같은 결과가 나온다.
 *
 * 넘어가는 길은 없다. 승인되지 않은 보호 경로 변경은 로컬에서도 CI 에서도 똑같이 실패한다 —
 * 승인 범위를 벗어난 변경이 조용히 통과할 자리를 두지 않는다.
 */
import { currentHashes, diffAgainst, readManifest } from './protected-manifest'

const manifest = readManifest()

if (!manifest) {
  console.error('\n❌ Protected 실패 — 승인 기록이 없습니다\n')
  console.error('  최초 승인이 필요합니다:')
  console.error('    npm run verify:approve -- --scope <경로> "최초 기준선"\n')
  process.exit(1)
}

const { changed, added, removed } = diffAgainst(manifest, currentHashes())
const total = changed.length + added.length + removed.length

if (total > 0) {
  console.error(`\n❌ Protected 실패 — 승인 범위 밖 보호 경로 변경 ${total}건\n`)
  for (const f of changed) console.error(`  변경  ${f}`)
  for (const f of added) console.error(`  추가  ${f}`)
  for (const f of removed) console.error(`  삭제  ${f}`)
  console.error('\n보호 경로는 사람이 승인한 범위에서만 바뀐다 (docs/harness/01-ssot.md §6).')
  console.error('사람이 지시한 변경이면 그 경로를 범위로 지정해 승인한다:')
  console.error('    npm run verify:approve -- --scope <경로> "왜 바꾸는지"')
  console.error('지시하지 않은 변경이면 되돌린다:')
  console.error('    git checkout -- <경로>\n')
  process.exit(1)
}

const paths = Object.entries(manifest.paths)
const latest = paths
  .map(([, a]) => a)
  .sort((a, b) => (a.approvedAt < b.approvedAt ? 1 : -1))[0]

console.log(
  `✅ Protected — 보호 경로 ${paths.length}개가 승인된 범위와 같다` +
    (latest ? ` (마지막 승인: ${latest.approvedBy}, ${latest.approvedAt.slice(0, 10)})` : '')
)
