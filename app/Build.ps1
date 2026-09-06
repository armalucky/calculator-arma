$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputFile = Join-Path $projectRoot 'BakhmutMap.exe'
if (Test-Path -LiteralPath $outputFile) {
    $running = Get-Process -Name BakhmutMap -ErrorAction SilentlyContinue
    if ($running) { throw 'Close BakhmutMap before rebuilding.' }
    Remove-Item -LiteralPath $outputFile
}
Add-Type -Path @((Join-Path $PSScriptRoot 'MapApp.cs'), (Join-Path $PSScriptRoot 'GameTables.cs'), (Join-Path $PSScriptRoot 'PositionPlanner.cs')) -ReferencedAssemblies 'System.Windows.Forms','System.Drawing','System.Web.Extensions' -OutputAssembly $outputFile -OutputType WindowsApplication
Write-Output "Built: $outputFile"
