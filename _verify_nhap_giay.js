// Verify: kho nhập fix + NCC fill from OCR
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const page = await browser.newPage()
  page.on('pageerror', err => console.log(`[PAGEERROR] ${err.message}`))

  // Login
  await page.goto('http://localhost:5173/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[id*="username"], input[placeholder*="dùng"]', 'admin')
  await page.fill('input[type="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 8000 }).catch(() => {})

  await page.goto('http://localhost:5173/warehouse/nhap-giay')
  await page.waitForLoadState('networkidle', { timeout: 12000 })
  await page.waitForSelector('table tbody tr:not(.ant-table-measure-row)', { timeout: 10000 })
  await page.waitForTimeout(500)

  const rows = page.locator('table tbody tr:not(.ant-table-measure-row)')
  const rowCount = await rows.count()
  console.log(`Table: ${rowCount} rows`)

  // ── TEST 1: Kho nhập sync ─────────────────────────────────────────────────
  // Find a row whose warehouse has phan_xuong_id (any "Chờ nhập" row will do)
  // We'll open GR#28 (Hoàng Gia) then verify kho shows correctly
  console.log('\n── TEST 1: Kho nhập sync ──')
  const row0Txt = await rows.nth(0).textContent()
  console.log(`Opening row 0: "${(row0Txt||'').slice(0,80)}"`)
  await rows.nth(0).locator('button').filter({ hasText: 'Hoàn thiện' }).click()
  await page.waitForSelector('.ant-modal-content', { timeout: 8000 })
  await page.waitForTimeout(600)
  console.log('✅ Modal opened')

  const khoVal = await page.locator('.ant-form-item').filter({ hasText: 'Kho nhập' })
    .locator('.ant-select-selection-item').textContent({ timeout: 2000 }).catch(() => '')
  const xuongVal = await page.locator('.ant-form-item').filter({ hasText: 'Xưởng' })
    .locator('.ant-select-selection-item').textContent({ timeout: 2000 }).catch(() => '')
  console.log(`Kho nhập: "${khoVal}"`)
  console.log(`Xưởng filter: "${xuongVal}"`)

  const t1Pass = khoVal && !khoVal.includes('Chọn kho') && khoVal.trim() !== ''
  console.log(t1Pass ? '✅ TEST 1 PASS: Kho hiển thị đúng' : '❌ TEST 1 FAIL')

  await page.screenshot({ path: 'd:\\NAM_PHUONG_SOFTWARE\\DU LIEU MPS\\erp-nam-phuong\\_verify_t1.png' })

  // Close modal
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // ── TEST 2: NCC fill from OCR ─────────────────────────────────────────────
  // Find GR#26: row with "Nam Thuận" warehouse (warehouse_id=13, has real OCR data)
  console.log('\n── TEST 2: NCC fill from OCR ──')
  let namThuanIdx = -1
  for (let i = 0; i < rowCount; i++) {
    const txt = await rows.nth(i).textContent()
    if (txt?.includes('Nam Thuận') && txt?.includes('Hoàn thiện')) { namThuanIdx = i; break }
  }
  if (namThuanIdx < 0) {
    console.log('⚠️  Không tìm được row Nam Thuận (GR#26) — thử row đầu có OCR data')
    // Fallback: open first row, check if OCR shows anything
    namThuanIdx = 0
  }

  const rowTxt = await rows.nth(namThuanIdx).textContent()
  console.log(`Opening row ${namThuanIdx}: "${(rowTxt||'').slice(0,90)}"`)
  await rows.nth(namThuanIdx).locator('button').filter({ hasText: 'Hoàn thiện' }).click()
  await page.waitForSelector('.ant-modal-content', { timeout: 8000 })
  await page.waitForTimeout(700)

  const ocrVisible = await page.locator(':text("OCR đã đọc xong")').isVisible().catch(() => false)
  if (!ocrVisible) {
    console.log('⚠️  No OCR data on this GR — TEST 2 SKIP')
    // Show NCC from DB
    const nccCurrent = await page.locator('.ant-form-item').filter({ hasText: 'Nhà cung cấp' })
      .locator('.ant-select-selection-item').textContent({ timeout: 2000 }).catch(() => '')
    console.log(`NCC hiện tại: "${nccCurrent}"`)
  } else {
    // Read OCR box content to see NCC detected
    const ocrBoxTxt = await page.locator('[style*="f6ffed"]').first().textContent().catch(() => '')
    console.log(`OCR box: "${ocrBoxTxt.slice(0, 150)}"`)

    await page.locator('button').filter({ hasText: 'Điền vào form' }).click()
    await page.waitForTimeout(700)

    const nccVal = await page.locator('.ant-form-item').filter({ hasText: 'Nhà cung cấp' })
      .locator('.ant-select-selection-item').textContent({ timeout: 2000 }).catch(() => '')
    console.log(`NCC sau điền: "${nccVal}"`)

    const t2Pass = nccVal && !nccVal.includes('Chọn nhà') && nccVal.trim() !== ''
    console.log(t2Pass ? `✅ TEST 2 PASS: NCC="${nccVal}"` : `❌ TEST 2 FAIL: NCC empty`)
  }

  await page.screenshot({ path: 'd:\\NAM_PHUONG_SOFTWARE\\DU LIEU MPS\\erp-nam-phuong\\_verify_t2.png' })
  console.log('\nScreenshots: _verify_t1.png, _verify_t2.png')
  await browser.close()
})()
