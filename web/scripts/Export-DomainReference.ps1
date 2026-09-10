$ErrorActionPreference='Stop'
$webRoot=Split-Path -Parent $PSScriptRoot
$projectRoot=Split-Path -Parent $webRoot
$work=Join-Path $webRoot 'work'
$fixtures=Join-Path $webRoot 'tests/fixtures'
[void][IO.Directory]::CreateDirectory($work)
[void][IO.Directory]::CreateDirectory($fixtures)
$assembly=Join-Path $work ('domain-reference-'+[Guid]::NewGuid().ToString('N')+'.dll')
$sources=@('app/MapApp.cs','app/GameTables.cs','app/PositionPlanner.cs','web/tests/reference/ExportDomainReference.cs') | ForEach-Object {Join-Path $projectRoot $_}
Add-Type -Path $sources -ReferencedAssemblies 'System.Windows.Forms','System.Drawing','System.Web.Extensions' -OutputAssembly $assembly -OutputType Library
[void][Reflection.Assembly]::LoadFrom($assembly)
[LuckyMapReference.Exporter]::Run($projectRoot,(Join-Path $fixtures 'domain-reference.json'))
