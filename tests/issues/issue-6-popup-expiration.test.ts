import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../helpers'
import { applyMovement } from '@/lib/stock'
import { getPopupDetail, getPopupList, settlePopupTx } from '@/lib/popup'
import { dateOnly, today, addDays } from '@/lib/date'

/**
 * Issue #6 — 기한이 지난 팝업을 현재 유효한 팝업과 구분해 보여준다.
 *
 * `it` 하나가 Issue 3번 종료 조건 한 줄에 대응한다 (02 §3).
 *
 * 판정 대상은 **조회 결과의 `overdue`** 다. 이 저장소의 테스트 환경은 `node` 이고
 * 컴포넌트 렌더러가 없어서(`vitest.config.ts`) 화면을 직접 그려 볼 수 없다.
 * 화면은 이 값을 그대로 배지로 렌더하므로, 조회가 무엇을 돌려주는지가 판정 지점이다.
 *
 * 시연용 시드(성수 팝업)는 건드리지 않고 테스트 전용 팝업만 만들고 지운다.
 */
const NAME = '__테스트 기한팝업'
const EXPIRY = dateOnly(addDays(today(), 200))

async function cleanup() {
  const popups = await db.popup.findMany({ where: { name: { startsWith: NAME } } })
  for (const popup of popups) {
    await db.movement.deleteMany({ where: { popupId: popup.id } })
    await db.popupPlan.deleteMany({ where: { popupId: popup.id } })
    await db.popup.delete({ where: { id: popup.id } })
    await db.lot.deleteMany({ where: { locationId: popup.locationId } })
    await db.location.delete({ where: { id: popup.locationId } })
  }
  await db.movement.deleteMany({ where: { expiryDate: EXPIRY } })
  await db.lot.deleteMany({ where: { expiryDate: EXPIRY } })
}

/** 종료일만 다른 팝업을 만든다. `withStock` 이면 정산할 수 있게 재고까지 넣는다 */
async function makePopup(suffix: string, endDate: Date, withStock = false) {
  const [own, user, product] = await Promise.all([
    db.location.findFirstOrThrow({ where: { type: 'OWN' } }),
    db.user.findFirstOrThrow(),
    db.product.findFirstOrThrow({ where: { sku: 'DOG-CHEESE-200' } }),
  ])
  const name = `${NAME}-${suffix}`
  const location = await db.location.create({ data: { name, type: 'POPUP' } })
  const popup = await db.popup.create({
    data: {
      name,
      status: 'ACTIVE',
      startDate: addDays(endDate, -3),
      endDate,
      locationId: location.id,
      sourceLocationId: own.id,
    },
  })

  if (withStock) {
    await db.$transaction(async (tx) => {
      await applyMovement(tx, {
        type: 'INBOUND',
        reason: 'PURCHASE',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 30,
        toLocationId: own.id,
        userId: user.id,
      })
      await applyMovement(tx, {
        type: 'POPUP_OUT',
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: 30,
        fromLocationId: own.id,
        toLocationId: location.id,
        popupId: popup.id,
        userId: user.id,
      })
    })
  }

  return { popup, location, user, product, name }
}

describe('Issue #6 — 기한이 지난 팝업 표시', () => {
  beforeAll(cleanup)
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('종료일이 지난 팝업을 조회하면 기한 지남으로 판정된다', async () => {
    const { popup, name } = await makePopup('past', addDays(today(), -1))

    const detail = await getPopupDetail(popup.id)
    expect(detail?.overdue).toBe(true)

    const row = (await getPopupList()).find((p) => p.name === name)
    expect(row?.overdue).toBe(true)
  })

  it('종료일 당일에는 기한 지남으로 판정되지 않는다', async () => {
    const { popup, name } = await makePopup('today', today())

    const detail = await getPopupDetail(popup.id)
    expect(detail?.overdue).toBe(false)

    const row = (await getPopupList()).find((p) => p.name === name)
    expect(row?.overdue).toBe(false)
  })

  it('종료일 이전에는 기한 지남으로 판정되지 않는다', async () => {
    const { popup, name } = await makePopup('future', addDays(today(), 5))

    const detail = await getPopupDetail(popup.id)
    expect(detail?.overdue).toBe(false)

    const row = (await getPopupList()).find((p) => p.name === name)
    expect(row?.overdue).toBe(false)
  })

  it('기한이 지나도 정산 확정 전이면 ACTIVE 상태와 정산 기능이 유지된다', async () => {
    const { popup, user, product } = await makePopup('active', addDays(today(), -7), true)

    // 날짜가 지났다는 것만으로 상태가 옮겨가지 않는다
    const before = await getPopupDetail(popup.id)
    expect(before?.overdue).toBe(true)
    expect(before?.popup.status).toBe('ACTIVE')

    // 그리고 정산이 그대로 된다 — 잔여 10 · 시식 5 → 차감 20 → 판매 15
    const lot = await db.lot.findFirstOrThrow({ where: { locationId: popup.locationId } })
    const totals = await db.$transaction((tx) =>
      settlePopupTx(tx, {
        popupId: popup.id,
        userId: user.id,
        returns: [{ lotId: lot.id, qty: 10 }],
        samples: [{ productId: product.id, qty: 5 }],
      })
    )
    expect(totals).toMatchObject({ shipped: 30, sold: 15, sample: 5, returned: 10 })
  })

  it('정산 확정으로 CLOSED 가 되는 기존 동작은 그대로다', async () => {
    const { popup, user } = await makePopup('settle', addDays(today(), -2), true)

    const lot = await db.lot.findFirstOrThrow({ where: { locationId: popup.locationId } })
    await db.$transaction((tx) =>
      settlePopupTx(tx, {
        popupId: popup.id,
        userId: user.id,
        returns: [{ lotId: lot.id, qty: 30 }],
        samples: [],
      })
    )

    const after = await db.popup.findUniqueOrThrow({ where: { id: popup.id } })
    expect(after.status).toBe('CLOSED')
    expect(after.settledAt).not.toBeNull()

    // 팝업 거점은 행사 단위로만 존재한다 (F2) — 정산 확정 시 비활성화된다
    const location = await db.location.findUniqueOrThrow({ where: { id: popup.locationId } })
    expect(location.isActive).toBe(false)
  })
})
