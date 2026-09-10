$ErrorActionPreference='Stop'
$webRoot=Split-Path -Parent $PSScriptRoot
$projectRoot=Split-Path -Parent $webRoot
$work=Join-Path $webRoot ('work/interop-'+[Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($work)
& node --experimental-strip-types (Join-Path $PSScriptRoot 'storage-interop.mjs') generate $work
if($LASTEXITCODE -ne 0){throw 'Fixture generation failed'}
$assembly=Join-Path $work 'desktop-storage.dll'
$sources=@('app/MapApp.cs','app/GameTables.cs','app/PositionPlanner.cs','app-lucky/Fleet.cs') | ForEach-Object {Join-Path $projectRoot $_}
Add-Type -Path $sources -ReferencedAssemblies 'System.Windows.Forms','System.Drawing','System.Web.Extensions' -OutputAssembly $assembly -OutputType Library
[void][Reflection.Assembly]::LoadFrom($assembly)
$fleet=[BakhmutMap.FleetState]::Load((Join-Path $work 'web.json'))
if($fleet.Guns.Count -ne 6 -or $fleet.ActiveId -ne 6){throw 'Desktop rejected fleet contents'}
$fleet.Save((Join-Path $work 'desktop.json'))
$classic=[BakhmutMap.Storage]::Load((Join-Path $work 'classic.json'))
$serializer=New-Object System.Web.Script.Serialization.JavaScriptSerializer
$sites=$serializer.Deserialize([IO.File]::ReadAllText((Join-Path $projectRoot 'data/maps/bakhmut/points.json')),[System.Collections.Generic.List[BakhmutMap.Site]])
[BakhmutMap.SiteNames]::ApplyScenarioNames($classic,$sites)
[BakhmutMap.Storage]::Save((Join-Path $work 'classic-desktop.json'),$classic)
& node --experimental-strip-types (Join-Path $PSScriptRoot 'storage-interop.mjs') verify $work
if($LASTEXITCODE -ne 0){throw 'Roundtrip verification failed'}
