/**
 * 보호 경로 변경 승인 — 사람이 실행한다.
 *
 * 원본: docs/harness/01-ssot.md §6 "보호 경로와 승인"
 *
 *   npm run verify:approve -- "왜 바꾸는지"
 *
 * 현재 내용을 승인된 기준선으로 기록한다. 기록은 커밋되어야 CI 에서도 통과한다.
 * AI 는 이 명령을 사람의 요청 없이 실행하지 않는다.
 *
 * 보호 경로 변경이 없어도 사유만 고쳐 적을 수 있다.
 * 사유를 빠뜨린 승인을 나중에 메울 수 있어야 하기 때문이다 — 해시는 건드리지 않는다.
 */
import { execSync } from 'node:child_process'
import { currentHashes, readManifest, writeManifest, type Manifest } from './protected-manifest'

const reason = process.argv.slice(2).join(' ').trim()

function gitUser(): string {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim()
    const email = execSync('git config user.email', { encoding: 'utf8' }).trim()
    return email ? `${name} <${email}>` : name
  } catch {
    return '알 수 없음'
  }
}

const before = readManifest()
const paths = currentHashes()

// 무엇을 승인하는지 사람이 보고 넘어가게 한다
if (before) {
  const changed = Object.keys(paths).filter((f) => f in before.paths && before.paths[f] !== paths[f])
  const added = Object.keys(paths).filter((f) => !(f in before.paths))
  const removed = Object.keys(before.paths).filter((f) => !(f in paths))
  if (changed.length + added.length + removed.length === 0) {
    // 승인할 내용은 그대로고 사유만 채우는 경우.
    // 해시를 다시 계산하지 않는다 — 무엇을 승인했는지는 바뀌지 않고, 기록의 '왜'만 채운다
    if (reason && reason !== before.reason) {
      writeManifest({ ...before, approvedAt: new Date().toISOString(), approvedBy: gitUser(), reason })
      console.log('\n✅ 사유 갱신 — 보호 경로 변경은 없습니다\n')
      console.log(`  이전  ${before.reason}`)
      console.log(`  지금  ${reason}`)
      console.log('\n이 기록을 함께 커밋해야 CI 에서도 통과합니다\n')
      process.exit(0)
    }
    console.log('승인할 변경이 없습니다 — 이미 기준선과 같습니다')
    if (!reason) console.log('사유만 고쳐 적으려면: npm run verify:approve -- "왜 바꾸는지"')
    process.exit(0)
  }
  console.log('\n▸ 다음 변경을 승인합니다\n')
  for (const f of changed) console.log(`  변경  ${f}`)
  for (const f of added) console.log(`  추가  ${f}`)
  for (const f of removed) console.log(`  삭제  ${f}`)
}

const manifest: Manifest = {
  note: '보호 경로 승인 기록 — docs/harness/01-ssot.md §6. 직접 편집하지 말고 npm run verify:approve 로 갱신한다',
  approvedAt: new Date().toISOString(),
  approvedBy: gitUser(),
  reason: reason || '(사유 미기재)',
  paths: Object.fromEntries(Object.entries(paths).filter(([, h]) => h !== '')),
}

writeManifest(manifest)
console.log(`\n✅ 승인 기록 갱신 — ${Object.keys(manifest.paths).length}개 경로`)
console.log(`   사유: ${manifest.reason}`)
console.log('   이 기록을 함께 커밋해야 CI 에서도 통과합니다\n')
