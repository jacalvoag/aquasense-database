import { test, expect } from '@playwright/test'

test('el inicio muestra cifras obtenidas de los registros reales', async ({ page, request }, info) => {
  const rep = await request.get('http://127.0.0.1:3001/reportes')
  const comp = await request.get('http://127.0.0.1:3001/componentes')
  expect(rep.ok()).toBe(true)
  expect(comp.ok()).toBe(true)
  const reportes = await rep.json() as { estado: string }[]
  const componentes = await comp.json() as { estado: string }[]
  await page.goto('/')
  await expect(page.locator('[data-metrica="pendientes"] strong')).toHaveText(String(reportes.filter((r) => r.estado === 'PENDIENTE').length))
  await expect(page.locator('[data-metrica="atencion"] strong')).toHaveText(String(reportes.filter((r) => r.estado === 'EN_ATENCION').length))
  await expect(page.locator('[data-metrica="activos"] strong')).toHaveText(String(componentes.filter((r) => r.estado === 'ACTIVO').length))
  await expect(page.getByRole('heading', { name: 'Lectura más reciente', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('inicio.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('una consulta fallida no se presenta como cero componentes', async ({ page }) => {
  // Solo este caso sustituye una respuesta para comprobar el aviso de indisponibilidad.
  await page.route('**/componentes', (ruta) => ruta.fulfill({
    status: 503, json: { message: 'Indisponible para esta prueba.' },
    headers: { 'Access-Control-Allow-Origin': '*' },
  }))
  await page.goto('/')
  await expect(page.locator('[data-metrica="activos"] strong')).toHaveText('—')
  await expect(page.getByText('Algunas cifras no están disponibles.', { exact: false })).toBeVisible()
})

test('la tubería candidata se explica antes de habilitar su registro', async ({ page }) => {
  await page.goto('/componentes')
  await expect(page.getByRole('heading', { name: 'Registrar tubería para reemplazo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Preparar tubería', exact: true })).toBeDisabled()
  await expect(page.getByText('La tubería se prepara sin conexiones.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Acceso de operador', exact: true }).click()
  await page.getByLabel('Usuario', { exact: true }).fill('operador')
  await page.getByLabel('Clave', { exact: true }).fill('operador-solo-pruebas')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Preparar tubería', exact: true })).toBeEnabled()
})
