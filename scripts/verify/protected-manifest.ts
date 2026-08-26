/**
 * 보호 경로 승인 기록 — 공통 모듈.
 *
 * 원본: docs/harness/01-ssot.md §6 "보호 경로와 승인"
 *
 * 승인은 내용 해시로 기록한다. git 이력이나 브랜치에 기대지 않으므로
 * 얕은 클론(CI)에서도 로컬과 똑같이 동작한다.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** 보호 경로 — SSOT가 원본으로 등록한 것들. 끝이 '/' 면 디렉터리 안의 .ts 전부 */
export const PROTECTED = [
  'docs/01-requirements.md',
  'docs/06-architecture.md',
  'docs/harness/01-ssot.md',
  'prisma/schema.prisma',
  'scripts/verify/',
] as const

/** 승인 기록 자신. 검사 대상에서는 빠진다 — 기록이 기록을 검사할 수는 없다 */
export const MANIFEST_PATH = 'scripts/verify/protected.json'

export type Manifest = {
  note: string
  approvedAt: string
  approvedBy: string
  reason: string
  paths: Record<string, string>
}

export function hashOf(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTs(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

/** 보호 경로를 실제 파일 목록으로 편다 */
export function expandProtected(): string[] {
  const files: string[] = []
  for (const entry of PROTECTED) {
    if (entry.endsWith('/')) {
      const dir = entry.slice(0, -1)
      if (existsSync(dir)) files.push(...walkTs(dir))
    } else if (existsSync(entry)) {
      files.push(entry)
    } else {
      files.push(entry) // 없는 파일도 목록에 넣는다 — 삭제를 잡기 위해
    }
  }
  return [...new Set(files)].filter((f) => f !== MANIFEST_PATH).sort()
}

export function currentHashes(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of expandProtected()) out[f] = existsSync(f) ? hashOf(f) : ''
  return out
}

export function readManifest(): Manifest | null {
  if (!existsSync(MANIFEST_PATH)) return null
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
}

export function writeManifest(m: Manifest): void {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(m, null, 2)}\n`)
}
