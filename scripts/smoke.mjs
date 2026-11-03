/**
 * Browser smoke test: the real production build in a portrait phone viewport.
 * It drives the menu, opens level 1, drags the paddle through the pointer
 * pipeline, launches, grants a power-up, pauses, and clears the level.
 *
 *   node scripts/smoke.mjs [url]
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5199/?debug=1'
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()

const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const shot = async (name) => {
  await page.screenshot({ path: `/tmp/bbz-${name}.png` })
  console.log(`  screenshot /tmp/bbz-${name}.png`)
}
const state = () => page.evaluate(() => window.__bb?.state() ?? null)

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('.title', { timeout: 60000 })
await page.waitForFunction(() => window.__bb !== undefined, { timeout: 20000 })
console.log('menu rendered')
await shot('menu')

await page.click('[data-action="worlds"]')
await page.waitForSelector('.world-grid', { timeout: 10000 })
const worldCount = await page.locator('.world-card').count()
console.log('worlds:', worldCount)
if (worldCount !== 10) {
  console.error(`Expected 10 worlds, got ${worldCount}`)
  process.exit(1)
}

await page.click('[data-action="levels:1"]')
await page.waitForSelector('.level-grid', { timeout: 10000 })
const levelCount = await page.locator('.level-tile').count()
console.log('levels in world 1:', levelCount)
if (levelCount !== 50) {
  console.error(`Expected 50 level tiles, got ${levelCount}`)
  process.exit(1)
}

await page.click('[data-action="level:1"]')
await page.waitForSelector('#hud', { timeout: 20000 })
console.log('level 1 opened:', await page.textContent('.hud-level'))
await shot('level')

const rect = await page.locator('#scene').boundingBox()
if (!rect) {
  console.error('canvas has no bounding box')
  process.exit(1)
}

// Drag the paddle to the left through the real pointer handlers.
const before = await state()
await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.78)
await page.mouse.down()
for (let step = 1; step <= 8; step += 1) {
  await page.mouse.move(rect.x + rect.width * (0.5 - step * 0.035), rect.y + rect.height * 0.78)
  await page.waitForTimeout(25)
}
await page.mouse.up()
const after = await state()
console.log(`paddle x: ${before?.paddleX} -> ${after?.paddleX}`)
if (after && before && Math.abs(after.paddleX - before.paddleX) < 4) {
  console.error('Dragging did not move the paddle')
  process.exit(1)
}

await page.waitForTimeout(250)
const launchVisible = await page.locator('#hud-launch').isVisible()
if (!launchVisible) {
  console.error('Launch button is not visible')
  process.exit(1)
}
await page.click('#hud-launch')
await page.waitForTimeout(1200)
const playing = await state()
console.log('after launch:', JSON.stringify(playing))
if (!playing || playing.phase === 'ready') {
  console.error('The ball did not launch')
  process.exit(1)
}
await shot('playing')

await page.evaluate(() => window.__bb?.grant('supermultiball'))
await page.waitForTimeout(300)
const multiball = await state()
console.log('after multiball:', JSON.stringify(multiball))
if (!multiball || multiball.balls < 2) {
  console.error('Multiball did not add balls')
  process.exit(1)
}

await page.click('[data-action="pause"]')
await page.waitForSelector('.overlay .sheet', { timeout: 5000 })
console.log('pause overlay:', (await page.textContent('.sheet h2'))?.trim())
await shot('pause')
await page.click('[data-action="resume"]')
await page.waitForTimeout(200)

const cleared = await page.evaluate(() => window.__bb?.win() ?? false)
if (!cleared) {
  console.error('Could not clear the level through the debug hook')
  process.exit(1)
}
await page.waitForSelector('.result.won', { timeout: 15000 })
console.log('result:', (await page.textContent('.result h2'))?.trim())
await shot('result')

await page.click('[data-action="next"]')
await page.waitForTimeout(700)
const nextState = await state()
const nextLevel = await page.evaluate(() => window.__bb?.level() ?? null)
console.log('next level:', nextLevel, JSON.stringify(nextState))
if (nextLevel !== 2) {
  console.error(`Expected level 2 after Next, got ${nextLevel}`)
  process.exit(1)
}

await browser.close()

if (errors.length > 0) {
  console.error('\nBrowser errors:')
  for (const error of errors) console.error(' ', error)
  process.exit(1)
}
console.log('\nSmoke test passed: menu, selection, touch paddle, launch, multiball, pause, victory, next level.')
