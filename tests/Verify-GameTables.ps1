$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
[void][Reflection.Assembly]::LoadFrom((Join-Path $projectRoot 'BakhmutMap.exe'))
$script:passed=0
function Check($condition,$message) {
    if (-not $condition) { throw "FAILED: $message" }
    $script:passed++
}
$tables=[BakhmutMap.GameTables]::Load((Join-Path $projectRoot 'data/game-tables.json'))
Check ($tables.Count -eq 11) 'All supplied pages loaded'
Check (($tables | ForEach-Object {$_.rows.Count} | Measure-Object -Sum).Sum -eq 140) 'All transcribed rows loaded'
$origin=[BakhmutMap.MapPoint]::new(4000,4000)
foreach($table in $tables) {
    foreach($row in @($table.rows[0],$table.rows[$table.rows.Count-1])) {
        $solution=[BakhmutMap.GameTables]::Calculate($table,$origin,[BakhmutMap.MapPoint]::new(4000+$row.distance,4000))
        Check ($solution.Available -and $solution.Elevation -eq $row.elevation -and $solution.Seconds -eq $row.seconds) "Inclusive endpoint: $($table.id) $($row.distance)"
    }
    foreach($distance in @(($table.rows[0].distance-0.01),($table.rows[$table.rows.Count-1].distance+0.01))) {
        $solution=[BakhmutMap.GameTables]::Calculate($table,$origin,[BakhmutMap.MapPoint]::new(4000+$distance,4000))
        Check (-not $solution.Available) "Reject extrapolation: $($table.id) $distance"
    }
}
$he4=$tables | Where-Object {$_.id -eq 'he4'}
$solution=[BakhmutMap.GameTables]::Calculate($he4,$origin,[BakhmutMap.MapPoint]::new(4900,4000))
Check ($solution.Elevation -eq 1311 -and $solution.Seconds -eq 32.5) 'Screenshot HE 4 rings at 900 metres'
$solution=[BakhmutMap.GameTables]::Calculate($he4,$origin,[BakhmutMap.MapPoint]::new(4950,4000))
Check ($solution.Elevation -eq 1299.5 -and $solution.ElevationUnits -eq 1300 -and [Math]::Abs($solution.Seconds-32.4) -lt 0.00001) 'Independent midpoint and integer rounding'
foreach($direction in @(@(4000,4900,0,0),@(4900,4000,90,1500),@(4000,3100,180,3000),@(3100,4000,270,4500))) {
    $solution=[BakhmutMap.GameTables]::Calculate($he4,$origin,[BakhmutMap.MapPoint]::new($direction[0],$direction[1]))
    Check ($solution.AzimuthDegrees -eq $direction[2] -and $solution.AzimuthUnits -eq $direction[3]) 'North-clockwise azimuth and 6000-unit circle'
}
$solution=[BakhmutMap.GameTables]::Calculate($he4,$origin,[BakhmutMap.MapPoint]::new(3999.9,4900))
Check ($solution.AzimuthUnits -eq 0) 'Rounded north wraps to zero'
$solution=[BakhmutMap.GameTables]::Calculate($he4,$origin,$origin)
Check (-not $solution.Available) 'Coincident points rejected'
$solution=[BakhmutMap.GameTables]::Calculate($he4,$null,$origin)
Check (-not $solution.Available) 'Unset position rejected'
$solution=[BakhmutMap.GameTables]::Calculate($he4,[BakhmutMap.MapPoint]::new(5192.207792207792,9404.310344827587),[BakhmutMap.MapPoint]::new(6091.538461538462,9328.97435897436))
Check ($solution.Available -and [Math]::Abs($solution.Distance-902.4805613) -lt 0.001 -and $solution.ElevationUnits -eq 1310 -and [Math]::Abs($solution.AzimuthDegrees-94.789) -lt 0.01) 'Original in-game test pair independently reproduced'
$fixture=Join-Path $PSScriptRoot 'output/game-selection.json'
$state=[BakhmutMap.Session]::new()
$state.TableId='smoke2'
[BakhmutMap.Storage]::Save($fixture,$state)
$restored=[BakhmutMap.Storage]::Load($fixture)
Check ($restored.TableId -eq 'smoke2') 'Game table selection round trip'
Write-Output "$script:passed game-table checks passed."
