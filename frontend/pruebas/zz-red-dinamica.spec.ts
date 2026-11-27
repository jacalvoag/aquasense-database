import { test, expect } from '@playwright/test'

test('registra espacios y componentes, conecta y actualiza el diagrama sin recargar', async ({ page, request }, info) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(15_000)
  const sufijo = Date.now().toString()
  const nombreZona = `Zona UI ${sufijo}`, codigo = `UI-TUB-${sufijo}`
  const clave = 'operador-solo-pruebas'
  async function acceso() {
    await page.getByRole('button', { name: 'Acceso de operador', exact: true }).click()
    await page.getByLabel('Usuario', { exact: true }).fill('operador')
    await page.getByLabel('Clave', { exact: true }).fill(clave)
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  }
  async function confirmado() {
    await expect(page.getByText('Cambio confirmado en la red. Ya puedes continuar.', { exact: true })).toBeVisible({ timeout: 20_000 })
  }
  async function navegar(nombre: string) {
    await page.locator('nav').getByRole('link', { name: nombre, exact: true }).click()
  }
  await page.goto('/espacios')
  await acceso()
  await page.getByLabel('Nombre del espacio', { exact: true }).fill(nombreZona)
  await page.getByLabel('Tipo de espacio', { exact: true }).selectOption('ZONA_RIEGO')
  const respuestaZona = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/espacios'))
  await page.getByRole('button', { name: 'Registrar espacio', exact: true }).click()
  const zona = await (await respuestaZona).json() as { espacioId: string }
  await confirmado()
  await page.reload()
  await expect(page.getByRole('rowheader', { name: nombreZona, exact: true })).toBeVisible()
  await acceso()
  await navegar('Componentes')
  await page.getByLabel('Tipo de componente', { exact: true }).selectOption('TUBERIA')
  await page.getByLabel('Código', { exact: true }).fill(codigo)
  await page.getByLabel('Nombre', { exact: true }).fill('Tubería registrada desde el navegador')
  await page.getByLabel('Ubicación', { exact: true }).selectOption(zona.espacioId)
  const respuestaComponente = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/componentes'))
  await page.getByRole('button', { name: 'Registrar componente', exact: true }).click()
  const componente = await (await respuestaComponente).json() as { componenteId: string }
  await confirmado()
  await navegar('Conexiones')
  await page.getByLabel('Componente de origen', { exact: true }).selectOption('20000000-0000-0000-0000-000000000003')
  await page.getByLabel('Componente de destino', { exact: true }).selectOption(componente.componenteId)
  await page.getByRole('button', { name: 'Crear conexión', exact: true }).click()
  await confirmado()
  await page.getByLabel('Componente de origen', { exact: true }).selectOption(componente.componenteId)
  await page.getByLabel('Tipo de destino', { exact: true }).selectOption('ESPACIO')
  await page.getByLabel('Espacio de destino', { exact: true }).selectOption(zona.espacioId)
  const respuestaSalida = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/conexiones'))
  await page.getByRole('button', { name: 'Crear conexión', exact: true }).click()
  const salida = await (await respuestaSalida).json() as { conexionId: string }
  await confirmado()
  await navegar('Red de agua')
  const figura = page.locator('.nodo-ilustrado').getByRole('button', { name: `${codigo}, Tubería registrada desde el navegador`, exact: true })
  await expect(figura).toBeVisible({ timeout: 15_000 })
  await figura.click()
  await expect(page.locator('.espacios-alcanzables')).toContainText(nombreZona)
  // Otro cliente modifica el destino mientras el diagrama permanece abierto.
  const actualizacion = await request.post(`http://127.0.0.1:3001/conexiones/${salida.conexionId}/actualizar`, {
    headers: { Authorization: `Basic ${Buffer.from('operador:' + clave).toString('base64')}` },
    data: { componenteOrigenId: componente.componenteId, espacioDestinoId: '10000000-0000-0000-0000-000000000003' },
  })
  expect(actualizacion.status()).toBe(201)
  await expect(page.locator('.espacios-alcanzables')).toContainText('UD3', { timeout: 20_000 })
  await page.screenshot({ path: info.outputPath('red-dinamica.png'), fullPage: true })
  await navegar('Conexiones')
  page.once('dialog', (dialogo) => dialogo.accept())
  await page.getByRole('button', { name: `Eliminar ${codigo} a UD3`, exact: true }).click()
  await confirmado()
  const conexiones = await (await request.get('http://127.0.0.1:3001/conexiones')).json() as { conexion_id: string }[]
  expect(conexiones.some((c) => c.conexion_id === salida.conexionId)).toBe(false)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
