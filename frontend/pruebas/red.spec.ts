import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

// No se interceptan solicitudes: requiere el estado final de test:sistema y la API real en 3001.
const ids = JSON.parse(await readFile(new URL('../../pruebas/resultados/identificadores.json', import.meta.url), 'utf8'))

test('red ilustrada con reemplazo real, alcance, teclado y vista móvil', async ({ page, request }, info) => {
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.emulateMedia({ colorScheme: 'dark' })
  const errores: string[] = []
  page.on('pageerror', (error) => errores.push(error.message))
  const snapshot = await (await request.get('http://127.0.0.1:3001/red')).json() as { versionRed: string; nodos: unknown[] }
  await page.goto('/red')
  await expect(page.locator('.nodo-ilustrado')).toHaveCount(snapshot.nodos.length)
  await expect(page.locator('.react-flow.light')).toHaveCount(1)
  const nueva = page.locator('.nodo-ilustrado').filter({ has: page.getByRole('button', { name: `${ids.codigoNueva}, Tubería de prueba integral`, exact: true }) })
  await nueva.getByRole('button').click()
  await expect(page.locator('.espacios-alcanzables li')).toHaveCount(1)
  await expect(page.locator('.espacios-alcanzables')).toContainText('Baños de estudiantes de UD1')
  await expect(page.locator('.conexion-activa')).toHaveCount(1)
  await expect(nueva).toHaveAttribute('data-elegido', 'true')
  await expect(page.locator('.barra-red')).toContainText(`Versión ${snapshot.versionRed}`)
  await page.screenshot({ path: info.outputPath('red-escritorio.png'), fullPage: true })
  await page.getByRole('button', { name: 'Acercar', exact: true }).click()
  await page.getByRole('button', { name: 'Ajustar a la vista', exact: true }).click()
  await page.getByRole('button', { name: 'Limpiar selección', exact: true }).click()
  await expect(page.locator('.conexion-activa')).toHaveCount(0)
  await nueva.getByRole('button').focus()
  await page.keyboard.press('Enter')
  await expect(nueva).toHaveAttribute('data-elegido', 'true')
  await expect(page.locator('.espacios-alcanzables li')).toHaveCount(1)
  expect(errores).toEqual([])
  // Se vuelve a cargar para comprobar la vista móvil inicial del mismo flujo.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/red')
  await expect(page.locator('.lista-nodos button')).toHaveCount(snapshot.nodos.length)
  await page.locator('.lista-nodos button').filter({ hasText: ids.codigoNueva }).click()
  await expect(page.locator('.espacios-alcanzables li')).toHaveCount(1)
  await expect(page.locator('.detalle-codigo')).toHaveText(ids.codigoNueva)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('red-movil.png'), fullPage: true })
})
