$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
[void][Reflection.Assembly]::LoadFrom((Join-Path $root 'BakhmutMap.exe'))
$script:passed=0
function Check($value,$message){if(-not $value){throw "FAILED: $message"};$script:passed++}
$tables=[BakhmutMap.GameTables]::Load((Join-Path $root 'data/m777-tables.json'))
Check ($tables.Count -eq 10) 'Five charges and two trajectories'
Check (($tables | ForEach-Object {$_.rows.Count} | Measure-Object -Sum).Sum -eq 400) '400 unique screenshot rows'
# Independent first/last readings: id, first range/elevation/time, last range/elevation/time.
$expected=@(
 @('m777-1-high',2800,1279,43.5,4400,993,38.0),
 @('m777-2-high',4400,1257,53.8,7000,884,43.9),
 @('m777-3-high',6800,1271,70.9,11400,853,56.5),
 @('m777-4-high',8800,1274,83.7,15000,855,67.0),
 @('m777-5-high',10600,1275,94.7,18000,881,77.6),
 @('m777-1-low',200,18,0.9,4000,464,20.7),
 @('m777-2-low',600,32,2.0,7000,632,34.0),
 @('m777-3-low',1000,28,2.4,11600,664,47.0),
 @('m777-4-low',1600,27,3.0,15000,553,48.7),
 @('m777-5-low',2000,23,3.1,18000,482,50.1)
)
$origin=[BakhmutMap.MapPoint]::new(0,0)
foreach($e in $expected){
 $table=$tables | Where-Object {$_.id -eq $e[0]}
 $first=$table.rows[0];$last=$table.rows[$table.rows.Count-1]
 Check ($first.distance -eq $e[1] -and $first.elevation -eq $e[2] -and $first.seconds -eq $e[3]) "First screenshot row $($e[0])"
 Check ($last.distance -eq $e[4] -and $last.elevation -eq $e[5] -and $last.seconds -eq $e[6]) "Last screenshot row $($e[0])"
 foreach($row in $table.rows){
  Check ($null -ne $row.source -and $row.source.StartsWith('references/m777-screenshots/')) 'Row provenance retained'
  if($row.distance -gt 14000){continue} # Map diagonal bounds make the longest rows unreachable here.
  $component=$row.distance/[Math]::Sqrt(2)
  $s=[BakhmutMap.GameTables]::Calculate($table,$origin,[BakhmutMap.MapPoint]::new($component,$component))
  Check ($s.Available -and [Math]::Abs($s.Elevation-$row.elevation) -lt 0.00001 -and [Math]::Abs($s.Seconds-$row.seconds) -lt 0.00001) 'Every reachable interior knot reproduced'
 }
}
$table=$tables | Where-Object {$_.id -eq 'm777-2-low'}
$s=[BakhmutMap.GameTables]::Calculate($table,$origin,[BakhmutMap.MapPoint]::new(6300,0))
Check ($s.Available -and $s.Elevation -eq 488 -and $s.Seconds -eq 27.25 -and $s.AzimuthUnits -eq 1600 -and $s.ElevationDegrees -eq 27.45) 'Independent midpoint and NATO scale'
foreach($d in @(599.9,7000.1)){
 $s=[BakhmutMap.GameTables]::Calculate($table,$origin,[BakhmutMap.MapPoint]::new($d,0))
 Check (-not $s.Available) 'Do not extrapolate to configuration-only ranges'
}
$s=[BakhmutMap.GameTables]::Calculate($table,$origin,[BakhmutMap.MapPoint]::new(7000,0))
Check ($s.Available -and $s.ElevationUnits -eq 632) 'Inclusive screenshot maximum'
$scale=[BakhmutMap.GameSolution]::new();$scale.UnitsPerCircle=6400;$scale.Elevation=497;$scale.AzimuthDegrees=171.4
Check ([Math]::Abs($scale.ElevationDegrees-28) -lt 0.05 -and [Math]::Abs($scale.AzimuthUnits-3046) -le 1) 'Sight screenshot approximately matches 6400 mil circle'
$state=[BakhmutMap.Session]::new();$state.WeaponId='m777';$state.TableId='he3';$state.M777TableId='m777-2-low'
$fixture=Join-Path $PSScriptRoot 'output/m777-session.json'
[BakhmutMap.Storage]::Save($fixture,$state)
$restored=[BakhmutMap.Storage]::Load($fixture)
Check ($restored.WeaponId -eq 'm777' -and $restored.TableId -eq 'he3' -and $restored.M777TableId -eq 'm777-2-low') 'Weapon choices survive restart'
Write-Output "$script:passed M777 checks passed."
