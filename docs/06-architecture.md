# 06. 아키텍처

> Phase 6 · 기준: [01-requirements.md](./01-requirements.md),
> [03-scenarios.md](./03-scenarios.md), [05-design.md](./05-design.md)

## 0. 이 앱이 실행되는 방식

강의·시연용 PoC이되 **상용 제품의 골격**을 갖춘다. 수강생이 저장소를
받아 네 줄이면 돈다.

    git clone <repo> && cd inventory_poc
    npm install
    npm run seed      # 강아지 간식 목업 데이터 주입 (임박 재고·배송 중·진행 중 팝업 포함)
    npm run dev       # http://localhost:3000

DB 서버 설치 없음. 계정 발급 없음. **`prisma/dev.db`** **파일 하나가
전부다.**

------------------------------------------------------------------------

## 1. 스택 확정

  -------------------------------------------------------------------------------
  층 선택 이유                                
  ------------ ------------------------------ -----------------------------------
  프레임워크   **Next.js 16 (App Router)**    서버 컴포넌트 + Server Actions로
                                              API 라우트 없이 DB 직결

  언어         **TypeScript**                 로트·이동처럼 숫자가 얽히는
                                              도메인에서 타입이 곧 안전장치

  DB           **SQLite** (`prisma/dev.db`)   파일 하나 = 무설치.
                                              강의·배포·백업이 전부 파일 복사

  ORM          **Prisma**                     `schema.prisma` 한 장이 설계도.
                                              `prisma studio`로 DB를 눈으로 시연

  스타일       **Tailwind CSS**               05-design.md 토큰을
                                              `tailwind.config.ts`에 그대로 심음

  인증         **자체 세션 쿠키** (`jose`     계정 2\~3개에 NextAuth는 과하다
               JWT + `bcryptjs`)              

  상태관리     **없음** (서버 컴포넌트 +      서버가 진실. 클라이언트 전역 상태를
               Server Actions + `useState`)   둘 이유가 없다

  테스트       **Vitest**                     재고 계산·FEFO·정산 역산은 반드시
                                              자동 테스트
  -------------------------------------------------------------------------------

### 실제 설치 버전 (M1 구현 시점, 2026-08-18)

| 패키지 | 버전 | 비고 |
|---|---|---|
| next / react | 16.3.1 / 19.2.8 | App Router |
| prisma / @prisma/client | 7.9.1 | **generator는 `prisma-client`**, 출력 경로 `src/generated/prisma` |
| @prisma/adapter-better-sqlite3 | 최신 | Prisma 7은 드라이버 어댑터로 SQLite에 접속한다 |
| tailwindcss | 4 | |
| bcryptjs / jose | 3 / 6 | 로그인 |
| vitest / tsx / dotenv | 최신 | |

Prisma 7에서 달라진 점 — 설정이 `prisma.config.ts`로 나뉘고, 클라이언트는 `@/generated/prisma/client`에서 가져온다.
`DATABASE_URL`은 `.env`에 두고 `prisma.config.ts`가 읽는다.

### 채택하지 않은 것

  -----------------------------------------------------------------------
  후보 이유             
  --------------------- -------------------------------------------------
  better-sqlite3 (생    가볍고 좋지만, `prisma studio`로 DB를 보여주는
  SQL)                  강의 가치가 더 컸다

  PostgreSQL            서버 설치가 필요해 "받아서 바로 실행"이 깨진다.
                        Prisma를 사용해 향후 PostgreSQL 전환 시
                        애플리케이션 레이어 변경을 최소화한다. 단, 실제
                        전환 시 마이그레이션·데이터 이전·DB별 타입/제약
                        차이 검토가 필요하다.

  NextAuth / Auth.js    계정 3개짜리 사내 도구엔 설정이 더 무겁다

  Zustand / Redux       재고 데이터는 전부 서버에 있다. 클라 전역 상태는
                        오히려 정합성 위험

  REST API 라우트       화면에서만 쓰는 내부 앱이라 Server Actions로 충분

  풀필먼트사 API 연동   Out of Scope (Phase 1)
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 2. 폴더 구조

    inventory_poc/
    ├── prisma/
    │   ├── schema.prisma            # 전체 데이터 모델 (설계도)
    │   ├── seed.ts                  # 목업 데이터 — 강아지 간식
    │   └── dev.db                   # SQLite 파일 (gitignore)
    │
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                     # 홈: 검색 + 재고 목록 + 할 일 배너
    │   │   ├── login/page.tsx
    │   │   ├── products/[id]/page.tsx        # 상품 상세 (로트 카드)
    │   │   ├── inbound/page.tsx              # 입고
    │   │   ├── outbound/page.tsx             # 출고 (FEFO)
    │   │   ├── transfers/
    │   │   │   ├── page.tsx                  # 배송 중 목록
    │   │   │   ├── new/page.tsx              # 풀필먼트 발송
    │   │   │   └── [id]/page.tsx             # 도착 확인
    │   │   ├── fulfillment/[locationId]/page.tsx   # 일일 출고 반영 (S5)
    │   │   ├── popups/
    │   │   │   ├── page.tsx                  # 팝업 목록
    │   │   │   ├── new/page.tsx              # 팝업 생성 + 반출서
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx              # 팝업 상세 (누적 반출)
    │   │   │       └── settle/page.tsx       # 정산 ①② + 리포트
    │   │   ├── expiry/page.tsx               # 유통기한 임박·만료·폐기
    │   │   ├── history/page.tsx              # 이력 + 취소
    │   │   └── settings/page.tsx             # 상품·거점·계정
    │   │
    │   ├── actions/                          # Server Actions — 쓰기는 전부 여기
    │   │   ├── inbound.ts
    │   │   ├── outbound.ts
    │   │   ├── transfer.ts
    │   │   ├── fulfillment.ts
    │   │   ├── popup.ts
    │   │   ├── adjust.ts
    │   │   └── auth.ts
    │   │
    │   ├── lib/
    │   │   ├── db.ts                # PrismaClient 싱글턴 + WAL 설정
    │   │   ├── fefo.ts              # ★ 로트 배분 — FEFO(출고) / LEFO(발송)
    │   │   ├── stock.ts             # ★ 재고 증감의 유일한 통로 (applyMovement)
    │   │   ├── expiry.ts            # 임박/만료 판정, 남은 기간 문구
    │   │   ├── session.ts           # JWT 쿠키 발급·검증
    │   │   └── format.ts            # 6자리 날짜 파싱, 숫자 포맷
    │   │
    │   ├── components/
    │   │   ├── SearchHeader.tsx
    │   │   ├── TodoBanner.tsx
    │   │   ├── FilterSegment.tsx
    │   │   ├── StockRow.tsx
    │   │   ├── LotCard.tsx
    │   │   ├── LocationChip.tsx
    │   │   ├── ExpiryKeypad.tsx      # 유통기한 6자리 (E1)
    │   │   ├── FefoPreview.tsx
    │   │   ├── BulkInputRow.tsx      # 다건 입력 (S5·S9)
    │   │   ├── SettlementSentence.tsx
    │   │   ├── ActionFab.tsx
    │   │   └── StatusBadge.tsx
    │   │
    │   └── middleware.ts             # 비로그인 → /login
    │
    ├── tests/
    │   ├── fefo.test.ts
    │   ├── stock-invariant.test.ts   # 총 재고 불변 검증
    │   └── popup-settle.test.ts
    │
    └── package.json

**규칙 하나**: 재고 수량을 바꾸는 코드는 `lib/stock.ts`의
`applyMovement()` **한 곳에만** 존재한다. 화면·액션은 이 함수를 부를 뿐,
`prisma.lot.update()`를 직접 호출하지 않는다.

------------------------------------------------------------------------

## 3. 데이터 모델 (`prisma/schema.prisma`)

    generator client { provider = "prisma-client-js" }
    datasource db    { provider = "sqlite"; url = env("DATABASE_URL") }

    // ───────── 사용자
    model User {
      id           Int        @id @default(autoincrement())
      email        String     @unique
      name         String
      passwordHash String
      role         String     @default("MEMBER")   // MEMBER | ADMIN
      movements    Movement[]
      createdAt    DateTime   @default(now())
    }

    // ───────── 상품
    model Product {
      id              Int      @id @default(autoincrement())
      sku             String   @unique
      name            String
      unit            String   @default("개")
      expiryAlertDays Int      @default(60)    // 품목마다 다른 임박 기준일
      isActive        Boolean  @default(true)
      lots            Lot[]
      movements       Movement[]
    }

    // ───────── 거점
    enum_LocationType_note // OWN | FULFILLMENT | POPUP | TRANSIT | DISPOSAL
    model Location {
      id               Int       @id @default(autoincrement())
      name             String
      type             String                        // 위 5종
      isActive         Boolean   @default(true)
      lastReflectedAt  DateTime?                     // 풀필먼트 마지막 반영일 (P6)
      lots             Lot[]
      popup            Popup?    @relation("PopupLocation")
    }

    // ───────── 로트 = 재고의 최소 단위
    model Lot {
      id         Int      @id @default(autoincrement())
      productId  Int
      locationId Int
      expiryDate DateTime
      quantity   Int      @default(0)

      product    Product  @relation(fields: [productId],  references: [id])
      location   Location @relation(fields: [locationId], references: [id])

      @@unique([productId, locationId, expiryDate])   // ★ 로트의 정의
      @@index([locationId, expiryDate])               // FEFO 조회용
    }

    // ───────── 이동 원장 — 이력의 진실
    model Movement {
      id             Int       @id @default(autoincrement())
      type           String    // INBOUND OUTBOUND TRANSFER POPUP_OUT POPUP_IN ADJUST DISPOSE
      reason         String?   // SALE SAMPLE DAMAGE LOSS DISPOSE PURCHASE RETURN COUNT_DIFF INPUT_ERROR OTHER
      note           String?

      productId      Int
      expiryDate     DateTime
      quantity       Int       // 항상 양수. 방향은 from/to로 표현
      fromLocationId Int?      // null = 외부에서 들어옴
      toLocationId   Int?      // null = 외부로 나감

      transferId     Int?
      popupId        Int?
      reversalOfId   Int?      // 상쇄 기록이 가리키는 원본 (취소)

      userId         Int
      createdAt      DateTime  @default(now())

      product        Product   @relation(fields: [productId], references: [id])
      user           User      @relation(fields: [userId],    references: [id])

      @@index([createdAt])
      @@index([productId, createdAt])
    }

    // ───────── 거점 간 이동 (발송 → 도착 확인)
    model Transfer {
      id             Int            @id @default(autoincrement())
      fromLocationId Int
      toLocationId   Int
      status         String         @default("SENT")   // SENT | RECEIVED | CANCELLED
      sentAt         DateTime       @default(now())
      receivedAt     DateTime?
      sentById       Int
      receivedById   Int?
      lines          TransferLine[]
    }

    model TransferLine {
      id           Int      @id @default(autoincrement())
      transferId   Int
      productId    Int
      expiryDate   DateTime
      sentQty      Int
      receivedQty  Int?               // 도착 시 실제 수량 (다르면 차이는 조정 기록)
      transfer     Transfer @relation(fields: [transferId], references: [id])
    }

    // ───────── 팝업 = 여러 번 반출되고 마지막에 정산되는 임시 거점
    model Popup {
      id               Int         @id @default(autoincrement())
      name             String
      status           String      @default("PREP")   // PREP | ACTIVE | SETTLING | CLOSED
      startDate        DateTime
      endDate          DateTime
      locationId       Int         @unique            // 이 팝업 전용 거점
      sourceLocationId Int                            // 보통 자사창고
      location         Location    @relation("PopupLocation", fields: [locationId], references: [id])
      planLines        PopupPlan[]
    }

    model PopupPlan {                                  // 반출서 = 계획. 재고를 움직이지 않는다
      id          Int   @id @default(autoincrement())
      popupId     Int
      productId   Int
      plannedQty  Int
      popup       Popup @relation(fields: [popupId], references: [id])
    }

> `enum_LocationType_note` 줄은 주석용 표기다. SQLite는 Prisma enum을
> 지원하지만, 강의에서 값 목록을 한눈에 보이게 하려고 문자열 +
> 상수(`lib/constants.ts`)로 다룬다.

문자열 상태값은 DB가 오타를 막아주지 않으므로 `lib/constants.ts`에서
`as const` 상수와 파생 타입으로 제한한다. Server Action의 입력도 이
타입과 런타임 검증을 통과한 값만 저장한다.

``` ts
export const LOCATION_TYPES = {
  OWN: 'OWN',
  FULFILLMENT: 'FULFILLMENT',
  POPUP: 'POPUP',
  TRANSIT: 'TRANSIT',
  DISPOSAL: 'DISPOSAL',
} as const

export type LocationType =
  typeof LOCATION_TYPES[keyof typeof LOCATION_TYPES]
```

### 왜 `Movement`에 `from`/`to`를 두는가

재고가 **사라지지 않고 이동한다**(P10)는 원칙을 스키마가 강제하기
위해서다.

  행위 from to                    
  --------------- --------------- ---------------
  입고            `null` (외부)   자사창고
  출고(판매)      자사창고        `null` (외부)
  풀필먼트 발송   자사창고        배송 중
  도착 확인       배송 중         풀필먼트 A
  팝업 반출       자사창고        성수 팝업
  팝업 판매       성수 팝업       `null`
  팝업 복귀       성수 팝업       자사창고
  폐기            자사창고        폐기

**양쪽이 모두 있으면 총 재고는 변하지 않는다.** 이것이 테스트로 검증할
불변식이다.

------------------------------------------------------------------------

## 4. 핵심 로직

### 4.1 `applyMovement()` --- 재고 증감의 유일한 통로

    // lib/stock.ts
    type MovementInput = {
      type: MovementType
      reason?: ReasonCode
      productId: number
      expiryDate: Date
      quantity: number          // 양수만
      fromLocationId?: number
      toLocationId?: number
      userId: number
      transferId?: number
      popupId?: number
      note?: string
    }

    export async function applyMovement(tx: PrismaTx, input: MovementInput) {
      if (input.quantity <= 0) throw new Error('수량은 1 이상이어야 합니다')

      // 1) 출발지에서 차감 — 음수 재고 금지
      if (input.fromLocationId) {
        const lot = await tx.lot.findUnique({ where: { productId_locationId_expiryDate: {
          productId: input.productId, locationId: input.fromLocationId, expiryDate: input.expiryDate }}})
        if (!lot || lot.quantity < input.quantity)
          throw new InsufficientStockError(input)      // 화면에서 저장 버튼 비활성
        await tx.lot.update({ where: { id: lot.id },
          data: { quantity: { decrement: input.quantity } } })
      }

      // 2) 도착지에 가산 — 없으면 로트 생성 (upsert)
      if (input.toLocationId) {
        await tx.lot.upsert({
          where:  { productId_locationId_expiryDate: {
            productId: input.productId, locationId: input.toLocationId, expiryDate: input.expiryDate }},
          create: { ...  , quantity: input.quantity },
          update: { quantity: { increment: input.quantity } },
        })
      }

      // 3) 이력 기록 — 항상 함께, 항상 같은 트랜잭션
      return tx.movement.create({ data: { ...input } })
    }

**규칙**

-   반드시 `prisma.$transaction()` 안에서 호출한다
-   여러 로트에 걸친 출고는 이 함수를 **로트 수만큼** 호출한다 (한
    트랜잭션 안에서)
-   화면·액션 코드는 절대 `lot.update`를 직접 하지 않는다

### 4.2 로트 배분 — FEFO와 LEFO

배분 방향은 **하나가 아니다.** 물건이 언제 소비되는지에 따라 반대가 된다.

| 동작 | 전략 | 이유 |
|---|---|---|
| 출고(판매·시식·파손) | **FEFO** 빠른 기한부터 | 곧 소비되므로 임박분부터 내보내야 안 버린다 |
| 풀필먼트 일일 반영 | **FEFO** | 이미 고객에게 나간 물량의 차감 |
| 팝업 반출 | **FEFO** | 현장에서 며칠 안에 팔린다 |
| **풀필먼트 발송** | **LEFO** 늦은 기한부터 | **도착 3~5일 + 판매 대기.** 임박분을 보내면 팔리기 전에 만료된다 |

```ts
// lib/fefo.ts
export const ALLOCATION = { FEFO: 'FEFO', LEFO: 'LEFO' } as const

/** 순수 함수 — 화면 미리보기와 서버가 같은 결과를 내야 한다 */
export function planAllocation(
  lots: FefoLot[], quantity: number, strategy: AllocationStrategy = 'FEFO'
) {
  const dir = strategy === 'LEFO' ? -1 : 1
  const sorted = [...lots]
    .filter((l) => l.quantity > 0)
    .sort((a, b) => dir * (a.expiryDate.getTime() - b.expiryDate.getTime()) || a.id - b.id)

  const plan: Allocation[] = []
  let remain = quantity
  for (const lot of sorted) {
    if (remain <= 0) break
    const take = Math.min(lot.quantity, remain)
    plan.push({ lotId: lot.id, expiryDate: lot.expiryDate, qty: take, lotQuantity: lot.quantity })
    remain -= take
  }
  return { plan, shortage: Math.max(0, remain) }
}

/** 서버 전용 — 저장 직전 DB의 현재 재고로 다시 계산한다 */
export async function allocateLots(tx, { productId, locationId, quantity, strategy = 'FEFO' })
```

**공통 규칙**
- 반드시 **한 거점 안에서만** 배분한다. 자사창고에서 빼는데 풀필먼트 재고를 제안하면 안 된다
- 만료된 로트도 후보에 포함한다 — 실물이 아직 있기 때문. 화면에서 빨간 배지로 경고한다
- LEFO에서 넉넉한 재고가 모자라면 임박분이 섞인다. 이때 화면에 **⚠ 임박분이 포함됐습니다**를 띄운다
- 수동 선택 시 `reason` 필수 (F5)

### 4.3 팝업 정산 역산

    // actions/popup.ts
    // 누적 반출 = POPUP_OUT 합계 − POPUP_IN 합계(이전 정산분)
    // 차감 = 누적 반출 − 이번 반입
    // 판매 = 차감 − 시식·증정
    export async function settlePopup(popupId: number, input: {
      returns: { productId: number; expiryDate: Date; qty: number }[]
      sampleQty: Record<number, number>       // 상품별 시식·증정
    }) {
      return db.$transaction(async tx => {
        for (const line of accumulated(popupId)) {
          const returned = findReturn(input.returns, line)
          const consumed = line.outQty - returned
          const sample   = input.sampleQty[line.productId] ?? 0
          if (sample > consumed) throw new Error('시식 수량이 차감분보다 클 수 없습니다')

          // ① 판매분 — 팝업 거점 → 외부
          if (consumed - sample > 0)
            await applyMovement(tx, { type:'POPUP_OUT', reason:'SALE',
              fromLocationId: popupLocationId, toLocationId: null, quantity: consumed - sample, ... })
          // ② 시식·증정분
          if (sample > 0)
            await applyMovement(tx, { type:'POPUP_OUT', reason:'SAMPLE', ... })
          // ③ 잔여 복귀 — 팝업 거점 → 자사창고 (사유 없음, 위치 이동)
          if (returned > 0)
            await applyMovement(tx, { type:'POPUP_IN',
              fromLocationId: popupLocationId, toLocationId: sourceLocationId, quantity: returned, ... })
        }
        await tx.popup.update({ where:{id:popupId}, data:{ status:'CLOSED' }})
      })
    }

**정산은 반드시 누적 반출 기준**이다 (P7). 1차 반출만 놓고 계산하면
판매량이 틀린다.

### 4.4 취소 = 상쇄 기록

삭제하지 않는다. 방향을 뒤집은 Movement를 만들고 `reversalOfId`로 원본을
가리킨다 (F10, P12).

**중복 취소 금지**: 하나의 원본 Movement에는 상쇄 Movement를 한 번만
허용한다. `reverseMovement()`는 같은 `reversalOfId`를 가진 기록이 이미
있는지 트랜잭션 안에서 확인하고, 있으면 취소를 거부한다.

가능하면 Prisma 관계도 명시한다.

``` prisma
model Movement {
  // ...
  reversalOfId Int?
  reversalOf   Movement?  @relation("Reversal", fields: [reversalOfId], references: [id])
  reversedBy   Movement[] @relation("Reversal")

  @@index([reversalOfId])
}
```

PoC에서는 애플리케이션 레벨 검증으로 충분하지만, 상용화 단계에서는 중복
상쇄를 DB 수준에서도 더 강하게 제한하는 방안을 검토한다.

------------------------------------------------------------------------

## 5. 상태 흐름

                                ┌──────────────┐
                  입고 ────────▶│              │────── 출고(판매/시식/파손) ──▶ 외부
                 (외부)         │   자사창고    │
                                │              │────── 폐기 ──▶ [폐기]
                                └──┬────────┬──┘
                                   │        │
                        발송 확정   │        │  팝업 반출 (여러 번)
                                   ▼        ▼
                            ┌──────────┐  ┌──────────┐
                            │ 배송 중   │  │  팝업     │
                            └────┬─────┘  └────┬─────┘
                         도착 확인│              │ 정산
                                 ▼              ├── 판매/시식 ──▶ 외부
                            ┌──────────┐        └── 잔여 ──▶ 자사창고
                            │ 풀필먼트  │
                            └────┬─────┘
                                 │ 일일 반영 (매일 수기)
                                 ▼
                               외부(고객)

      ※ 화살표 양끝이 모두 내부 거점이면 총 재고는 불변.
         외부가 한쪽에 있으면 그때만 총 재고가 변한다.

### 데이터 흐름 (쓰기)

    사용자 조작
       ↓
    Server Action  (actions/*.ts)          ← 유효성 검증 · 세션에서 userId
       ↓
    db.$transaction
       ↓
    도메인 로직                              ← FEFO 조회·정산 계산도 같은 tx 사용
       ├─ allocateFefo(tx)
       ├─ settlePopup(tx)
       └─ reverseMovement(tx)
       ↓
    applyMovement(tx) × N                  ← Lot 갱신 + Movement 기록을 원자적으로
       ↓
    revalidatePath('/')                    ← 서버 컴포넌트 재렌더
       ↓
    화면 갱신 (전역 상태 없음)

------------------------------------------------------------------------

## 6. 인증

    로그인 폼 → actions/auth.ts
       bcrypt.compare(입력, user.passwordHash)
       → jose로 JWT 서명 → httpOnly · sameSite=lax 쿠키 (7일)

    middleware.ts
       쿠키 없음 → /login 리다이렉트
       있으면 검증 후 통과

    Server Action마다
       getSession() → userId → Movement.userId 에 기록

-   회원가입 화면 없음. 계정은 시드로 심고 설정 화면에서 추가 (F11)
-   비밀번호는 bcrypt 해시로만 저장. 시드 계정도 마찬가지
-   역할 구분은 `role` 필드만 두고 **MVP에서는 기능 차이를 두지 않는다**
    (Out of Scope)

------------------------------------------------------------------------

## 7. 시드 데이터 설계 (`prisma/seed.ts`)

**목표: 시드 직후 모든 화면에 보여줄 것이 있어야 한다.** 빈 화면이
하나라도 있으면 시연이 끊긴다.

  -----------------------------------------------------------------------------
  항목 내용  
  ---------- ------------------------------------------------------------------
  계정       `warehouse@demo.kr` (이현, 물류) / `sales@demo.kr` (민수, 영업) ·
             비밀번호 `demo1234`

  거점       자사창고 · 풀필먼트 A/B/C · 배송 중 · 폐기 · 성수 팝업

  상품 12종  강아지 치즈 간식 200g / 우유껌 M / 오리목뼈 껌 5p / 닭가슴살 저키
             100g / 고구마 말랭이 150g / 연어 트릿 80g / 소고기 육포 120g /
             치킨 스틱 10p / 비건쿠키 딸기·당근·블루베리·고구마 40g (각 80개)

  로트       상품마다 2\~3개 유통기한. **임박 3건 · 만료 2건 포함**

  배송 중    3건 --- 그중 1건은 **8일 경과(지연 경고 확인용)**

  풀필먼트   A·B는 오늘, **C는 3일 전** (할 일 배너 확인용)
  반영       

  팝업       성수 팝업 진행 중 · **반출 2회(120 + 40 = 160)** · 정산 대기

  이력       최근 30건 --- 입고·출고·이동·조정·폐기가 골고루, 두 사용자가
             섞여서
  -----------------------------------------------------------------------------

    // package.json
    "scripts": {
      "dev": "next dev",
      "seed": "tsx prisma/seed.ts",
      "seed:reset": "rm -f prisma/dev.db && prisma migrate dev --name init && tsx prisma/seed.ts",
      "db:studio": "prisma studio",
      "test": "vitest run"
    }

`npm run seed:reset` --- 시연 중 데이터가 엉키면 5초 만에 초기 상태로
되돌린다.

------------------------------------------------------------------------

## 7.5 아키텍처 결정 요약

``` text
Next.js (React UI + Server Components)
        ↓
Server Actions
        ↓
db.$transaction()
        ↓
Domain Logic
  ├─ allocateFefo(tx)
  ├─ applyMovement(tx)
  ├─ settlePopup(tx)
  └─ reverseMovement(tx)
        ↓
Prisma ORM
        ↓
SQLite
```

-   **SQLite**는 실제 데이터를 저장하는 DB다.
-   **Prisma**는 Next.js 서버 코드에서 SQLite를 타입 안전하게 다루는
    ORM이다.
-   React 컴포넌트가 Prisma를 직접 호출하는 구조가 아니라, **서버
    영역에서만 Prisma를 사용한다.**
-   재고의 현재값은 `Lot`, 변경 원장은 `Movement`가 담당한다.
-   재고 변경과 원장 기록은 반드시 같은 트랜잭션에서 성공하거나 함께
    롤백된다.
-   복잡한 조회가 필요해지면 Prisma를 유지하면서 제한적으로 raw SQL을
    사용할 수 있다.

------------------------------------------------------------------------

## 8. 동시성 · 성능

-   SQLite는 **WAL 모드**로 연다 (`PRAGMA journal_mode = WAL`) ---
    읽기와 쓰기가 서로 막지 않는다
-   2\~3명 규모에서 쓰기 충돌은 사실상 없다. 다만 모든 재고 변경은
    트랜잭션이므로 충돌 시 재시도 1회
-   `Lot`에 `@@index([locationId, expiryDate])` --- FEFO 조회가 정렬
    없이 인덱스로 끝난다
-   목록 조회는 서버 컴포넌트에서 한 번에 집계. SKU 수백 개까지 문제
    없다

------------------------------------------------------------------------

## 9. 자동 테스트로 지킬 불변식

  --------------------------------------------------------------------------
  \# 검증                                        
  파일                                           
  -------- ------------------------------------- ---------------------------
  1        FEFO는 항상 유통기한 빠른 로트부터    `fefo.test.ts`
           배분한다                              

  2        수량이 여러 로트에 걸치면 정확히 쪼개 `fefo.test.ts`
           배분한다                              

  3        재고보다 많이 출고하면 예외를 던지고  `stock-invariant.test.ts`
           **아무것도 바뀌지 않는다**            

  4        발송 → 도착 확인 전후로 **총 재고     `stock-invariant.test.ts`
           합계가 같다**                         

  5        팝업 반출 2회 후 정산하면 **누적      `popup-settle.test.ts`
           기준**으로 판매가 역산된다            

  6        시식 수량이 차감분보다 크면 저장되지  `popup-settle.test.ts`
           않는다                                

  7        취소(상쇄) 후 로트 수량이 원래대로    `stock-invariant.test.ts`
           돌아온다                              
  --------------------------------------------------------------------------
