$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvDir = Join-Path $projectDir '.venv-build'
$venvPython = Join-Path $venvDir 'Scripts\python.exe'
$venvPip = Join-Path $venvDir 'Scripts\pip.exe'
$sitePackages = Join-Path $venvDir 'Lib\site-packages'
$packageName = 'DLSite-ASMR-Player'
$packageDir = Join-Path $projectDir "dist\$packageName"
$archivePath = Join-Path $projectDir "dist\$packageName-windows-x64.zip"

if (-not (Test-Path -LiteralPath $venvPython)) {
    python -m venv $venvDir
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to create the build virtual environment.'
    }
}

if (-not (Test-Path -LiteralPath $venvPip)) {
    python -m venv --clear $venvDir
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to repair the build virtual environment.'
    }
}

if (
    -not (Test-Path -LiteralPath (Join-Path $sitePackages 'flask')) -or
    -not (Test-Path -LiteralPath (Join-Path $sitePackages 'waitress')) -or
    -not (Test-Path -LiteralPath (Join-Path $sitePackages 'PyInstaller'))
) {
    & $venvPython -m pip install --disable-pip-version-check -r (Join-Path $projectDir 'requirements-build.txt')
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to install build dependencies.'
    }
}

$pyInstallerArgs = @(
    '--noconfirm'
    '--clean'
    '--onedir'
    '--console'
    '--name', $packageName
    '--add-data', "$(Join-Path $projectDir 'static');static"
    (Join-Path $projectDir 'launcher.py')
)

# Conda-based Python installations keep extension-module dependencies here.
# PyInstaller does not always discover them automatically from a venv.
$pythonBase = (& $venvPython -c 'import sys; print(sys.base_prefix)').Trim()
$pythonRuntimeBin = Join-Path $pythonBase 'Library\bin'
foreach ($dllName in @(
    'ffi.dll'
    'libcrypto-3-x64.dll'
    'libssl-3-x64.dll'
    'liblzma.dll'
    'LIBBZ2.dll'
    'libexpat.dll'
)) {
    $dllPath = Join-Path $pythonRuntimeBin $dllName
    if (Test-Path -LiteralPath $dllPath) {
        $pyInstallerArgs += @('--add-binary', "$dllPath;.")
    }
}

& $venvPython -m PyInstaller @pyInstallerArgs
if ($LASTEXITCODE -ne 0) {
    throw 'PyInstaller failed to build the application.'
}

Copy-Item -LiteralPath (Join-Path $projectDir 'media_roots.example.json') -Destination (Join-Path $packageDir 'media_roots.json') -Force
Copy-Item -LiteralPath (Join-Path $projectDir 'README.md') -Destination $packageDir -Force
$null = New-Item -ItemType Directory -Path (Join-Path $packageDir 'media') -Force

for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        if (Test-Path -LiteralPath $archivePath) {
            Remove-Item -LiteralPath $archivePath -Force
        }
        Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $archivePath -CompressionLevel Optimal
        break
    } catch {
        if ($attempt -eq 5) {
            throw
        }
        Start-Sleep -Seconds 2
    }
}

Write-Output "Package directory: $packageDir"
Write-Output "Archive: $archivePath"
