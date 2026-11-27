[CmdletBinding()]
param(
    [switch]$Instalar,
    [switch]$SoloComprobar,
    [switch]$NoAbrirNavegador
)
$ErrorActionPreference = 'Stop'
$raizProyecto = $PSScriptRoot
$versionNode = & node --version
if ($LASTEXITCODE -ne 0) { throw 'Instala Node.js antes de iniciar AquaSense.' }
if ([int]($versionNode.TrimStart('v').Split('.')[0]) -lt 24) { throw 'Se requiere Node.js 24 o posterior. La guía recomienda Node 26.' }

Push-Location -LiteralPath $raizProyecto
try {
    foreach ($proyecto in @('api', 'sincronizador', 'frontend')) {
        if ($Instalar) {
            Push-Location -LiteralPath (Join-Path $raizProyecto $proyecto)
            try {
                & npm ci
                if ($LASTEXITCODE -ne 0) { throw ('No se pudieron instalar las dependencias de ' + $proyecto + '.') }
            } finally { Pop-Location }
        }
        if (-not (Test-Path -LiteralPath (Join-Path $raizProyecto ($proyecto + '/node_modules')))) {
            throw ('Faltan las dependencias de ' + $proyecto + '. Ejecuta .\iniciar.ps1 -Instalar.')
        }
    }

    $argumentosNode = @('scripts/comprobar-servicios.mjs')
    if ($SoloComprobar) { $argumentosNode += '--solo-configuracion' }
    $salidaConfiguracion = & node @argumentosNode
    if ($LASTEXITCODE -ne 0) { throw 'Corrige la configuración o inicia las bases indicadas antes de continuar.' }
    $configuracion = ($salidaConfiguracion -join [Environment]::NewLine) | ConvertFrom-Json
    if ($SoloComprobar) {
        Write-Host 'Configuración y dependencias válidas. No se iniciaron aplicaciones ni se comprobaron conexiones.'
        return
    }
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'Este lanzador abre terminales de Windows. En otros sistemas usa los comandos de docs/ejecucion-local.md.'
    }

    function Test-PuertoLocal([int]$puerto) {
        $cliente = New-Object System.Net.Sockets.TcpClient
        try {
            $tarea = $cliente.ConnectAsync('127.0.0.1', $puerto)
            if (-not $tarea.Wait(500)) { return $false }
            return $cliente.Connected
        } catch { return $false }
        finally { $cliente.Dispose() }
    }
    if ((Test-PuertoLocal ([int]$configuracion.apiPuerto)) -or (Test-PuertoLocal 5173)) {
        throw 'El puerto de la API o el 5173 ya está ocupado. Detén las sesiones anteriores antes de usar este lanzador.'
    }
    $shellWindows = (Get-Command powershell.exe -ErrorAction Stop).Source
    function Abrir-Terminal([string]$carpeta, [string]$comando) {
        $ruta = (Join-Path $raizProyecto $carpeta).Replace("'", "''")
        $orden = "Set-Location -LiteralPath '" + $ruta + "'; " + $comando
        Start-Process -FilePath $shellWindows -WorkingDirectory (Join-Path $raizProyecto $carpeta) -ArgumentList @('-NoExit', '-Command', $orden) | Out-Null
    }
    Abrir-Terminal 'api' 'npm run start:dev'
    $lista = $false
    for ($intento = 0; $intento -lt 45; $intento++) {
        try {
            $salud = Invoke-RestMethod -Uri ($configuracion.apiUrl + '/salud/postgres') -TimeoutSec 2
            if ($salud.estado -eq 'ok') { $lista = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $lista) { throw 'La API no respondió. Revisa la terminal de la API; las demás aplicaciones no se han iniciado.' }

    Abrir-Terminal 'sincronizador' 'npm run dev'
    $apiPublica = ([string]$configuracion.apiUrl).Replace("'", "''")
    Abrir-Terminal 'frontend' ("$" + "env:VITE_API_BASE_URL = '" + $apiPublica + "'; npm run dev:local")
    $frontendListo = $false
    for ($intento = 0; $intento -lt 30; $intento++) {
        if (Test-PuertoLocal 5173) { $frontendListo = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $frontendListo) { throw 'El frontend no respondió. Revisa su terminal de Vite.' }
    Write-Host ('AquaSense disponible en ' + $configuracion.frontendUrl)
    Write-Host 'Para detenerlo, usa Ctrl+C en las tres terminales. Ejecuta una sola instancia del sincronizador.'
    if (-not $NoAbrirNavegador) { Start-Process ([string]$configuracion.frontendUrl) }
} finally { Pop-Location }
