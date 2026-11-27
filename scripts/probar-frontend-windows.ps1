$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$frontendOriginal = Join-Path $raiz 'frontend'
$carpetaPrueba = Join-Path ([IO.Path]::GetTempPath()) ('AquaSense prueba Windows ' + [guid]::NewGuid().ToString('N'))
$frontendPrueba = Join-Path $carpetaPrueba 'frontend con espacios'
[void](New-Item -ItemType Directory -Path $frontendPrueba -Force)
Get-ChildItem -LiteralPath $frontendOriginal -Force |
    Where-Object { $_.Name -notin @('node_modules', 'dist') } |
    Copy-Item -Destination $frontendPrueba -Recurse -Force
[void](New-Item -ItemType Junction -Path (Join-Path $frontendPrueba 'node_modules') -Target (Join-Path $frontendOriginal 'node_modules'))
$shellWindows = (Get-Command powershell.exe).Source
$procesos = @()
function Iniciar-Vite([string]$nombre) {
    $salida = Join-Path $carpetaPrueba ($nombre + '.log')
    $errorLog = Join-Path $carpetaPrueba ($nombre + '-error.log')
    # El mismo script npm del lanzador; sin reenviar opciones desde PowerShell.
    $comando = "$" + "env:VITE_API_BASE_URL='http://127.0.0.1:3001'; npm run dev:local; exit $" + "LASTEXITCODE"
    return Start-Process -FilePath $shellWindows -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', $comando) -WorkingDirectory $frontendPrueba -RedirectStandardOutput $salida -RedirectStandardError $errorLog -PassThru
}
try {
    $primero = Iniciar-Vite 'primero'
    $procesos += $primero
    $listo = $false
    for ($intento = 0; $intento -lt 30; $intento++) {
        $primero.Refresh()
        if ($primero.HasExited) { throw 'Vite terminó antes de responder.' }
        try {
            $respuesta = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 2
            if ($respuesta.StatusCode -eq 200 -and $respuesta.Content -match '/@vite/client') { $listo = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $listo) { throw 'Vite no respondió en el puerto 5173.' }

    # strictPort debe impedir una segunda instancia, sin pasarla a otro puerto.
    $segundo = Iniciar-Vite 'segundo'
    $procesos += $segundo
    if (-not $segundo.WaitForExit(15000)) { throw 'La segunda instancia no respetó strictPort.' }
    if ($segundo.ExitCode -eq 0) { throw 'Se esperaba un error por el puerto ocupado.' }
    $registro = Get-Content -LiteralPath (Join-Path $carpetaPrueba 'segundo-error.log') -Raw
    if ($registro -notmatch '5173.*already in use') { throw 'La segunda instancia falló por una causa distinta al puerto ocupado.' }
    $primero.Refresh()
    if ($primero.HasExited) { throw 'La primera instancia dejó de responder.' }
    Write-Host 'Vite responde en Windows y en una ruta con espacios; strictPort rechaza una segunda instancia.'
} finally {
    foreach ($proceso in $procesos) {
        $proceso.Refresh()
        if (-not $proceso.HasExited) { & taskkill.exe /PID $proceso.Id /T /F | Out-Null }
    }
    Get-ChildItem -LiteralPath $carpetaPrueba -Filter '*.log' | ForEach-Object {
        Write-Host $_.Name
        Get-Content -LiteralPath $_.FullName
    }
}
