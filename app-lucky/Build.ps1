param([string]$OutputName='LuckyMap.exe')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$outputFile=Join-Path $projectRoot $OutputName
if(Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($OutputName)) -ErrorAction SilentlyContinue){throw 'Close the target application before rebuilding.'}
$python=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
if(-not (Test-Path $python)){$python=(Get-Command python -ErrorAction Stop).Source}
& $python -X utf8 -B (Join-Path $projectRoot 'tools/prepare_lucky_language.py')
if($LASTEXITCODE -ne 0){throw 'Localization generation failed'}
if(Test-Path -LiteralPath $outputFile){Remove-Item -LiteralPath $outputFile}
Add-Type -Path @((Join-Path $PSScriptRoot 'generated/MapApp.cs'),(Join-Path $PSScriptRoot 'generated/LuckyUI.cs'),(Join-Path $PSScriptRoot 'generated/Fleet.cs'),(Join-Path $PSScriptRoot 'VectorRoadLayer.cs'),(Join-Path $PSScriptRoot 'VectorBuildingLayer.cs'),(Join-Path $PSScriptRoot 'generated/GameTables.cs'),(Join-Path $PSScriptRoot 'generated/PositionPlanner.cs'),(Join-Path $PSScriptRoot 'LuckyLanguage.cs'),(Join-Path $PSScriptRoot 'WindowMode.cs'),(Join-Path $PSScriptRoot 'generated/LanguageData.cs')) -ReferencedAssemblies 'System.Windows.Forms','System.Drawing','System.Web.Extensions' -OutputAssembly $outputFile -OutputType WindowsApplication
Write-Output "Built: $outputFile (classic version untouched)"
