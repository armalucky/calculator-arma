$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web.Extensions
[void][Reflection.Assembly]::LoadFrom((Join-Path $projectRoot 'BakhmutMap.exe'))
$script:passed=0
function Check($value,$message) {if(-not $value){throw "FAILED: $message"};$script:passed++}
function Point($x,$z) {return [BakhmutMap.MapPoint]::new($x,$z)}
function Rectangle($x,$z,$width,$height) {
    $vertices=[double[][]]@([double[]]@($x,$z),[double[]]@(($x+$width),$z),[double[]]@(($x+$width),($z+$height)),[double[]]@($x,($z+$height)))
    return [BakhmutMap.RoadShape]::new($vertices)
}
$shape=Rectangle 1000 1000 100 20
$index=[BakhmutMap.RoadIndex]::new([BakhmutMap.RoadShape[]]@($shape))
Check ($index.Distance((Point 1050 1010)) -eq 0) 'Road interior distance is zero'
Check ($index.Distance((Point 1050 1050)) -eq 30) 'Road offset measured from edge, not centreline'
Check ($index.Distance((Point 1130 1060)) -eq 50) 'Distance to polygon corner'
Check ($index.Distance((Point 1100 1010)) -eq 0) 'Road edge excluded even with zero setback'
$shapes=[Collections.Generic.List[BakhmutMap.RoadShape]]::new()
for($i=0;$i -lt 32;$i++) {$shapes.Add((Rectangle (100+$i*90) (200+($i%5)*200) 70 30))}
$tree=[BakhmutMap.RoadIndex]::new($shapes)
$random=[Random]::new(2026)
for($i=0;$i -lt 60;$i++) {
    $p=Point ($random.NextDouble()*4000) ($random.NextDouble()*2000)
    $brute=[double]::PositiveInfinity
    foreach($s in $shapes) {$brute=[Math]::Min($brute,$s.DistanceSquared($p.X,$p.Z))}
    Check ([Math]::Abs($tree.Distance($p)-[Math]::Sqrt($brute)) -lt 0.000001) 'Spatial index matches exhaustive nearest road'
}
$tables=[BakhmutMap.GameTables]::Load((Join-Path $projectRoot 'data/game-tables.json'))
$table=$tables | Where-Object {$_.id -eq 'he4'}
$roads=[BakhmutMap.RoadIndex]::new([BakhmutMap.RoadShape[]]@((Rectangle 100 100 200 20)))
$sites=[Collections.Generic.List[BakhmutMap.Site]]::new()
$site=[BakhmutMap.Site]::new();$site.id='test';$site.name='test';$site.x=5000;$site.z=4000;$sites.Add($site)
$options=[BakhmutMap.PlanningOptions]::new()
$target=Point 4000 4000
$a=[BakhmutMap.PositionPlanner]::Assess($table,$target,(Point 6100 4000),$options,$roads,$sites)
Check ($a.Allowed -and $a.Reserve -eq 200) 'Reserve inclusive at 2100 metres'
$a=[BakhmutMap.PositionPlanner]::Assess($table,$target,(Point 6100.1 4000),$options,$roads,$sites)
Check (-not $a.RangeAllowed) 'Reject insufficient reserve'
$a=[BakhmutMap.PositionPlanner]::Assess($table,$target,(Point 4399 4000),$options,$roads,$sites)
Check (-not $a.RangeAllowed) 'Minimum table distance preserved'
$a=[BakhmutMap.PositionPlanner]::Assess($table,$target,(Point 5300 4000),$options,$roads,$sites)
Check ($a.SiteAllowed -and $a.SiteDistance -eq 300) 'Site exclusion boundary inclusive'
$a=[BakhmutMap.PositionPlanner]::Assess($table,$target,(Point 5299 4000),$options,$roads,$sites)
Check (-not $a.Allowed -and -not $a.SiteAllowed) 'Nearby scenario site excludes position'
$a=[BakhmutMap.PositionPlanner]::Assess($table,$target,(Point 5000 4000),$options,$roads,$sites)
Check (-not $a.SiteAllowed) 'Scenario site itself excluded'
$mask=[BakhmutMap.PositionPlanner]::CreateMask($table,$target,$options,$roads,$sites)
try {
    Check ($mask.Cells -gt 0) 'Usable area exists'
    $checkedCells=0
    for($y=0;$y -lt 512;$y+=7) {for($x=0;$x -lt 512;$x+=7) {
        if($mask.Image.GetPixel($x,$y).A -eq 0){continue}
        $checkedCells++
        foreach($corner in @(@(0,0),@(20,0),@(20,20),@(0,20))) {
            $p=Point ($x*20+$corner[0]) ((511-$y)*20+$corner[1])
            $a=[BakhmutMap.PositionPlanner]::Assess($table,$target,$p,$options,$roads,$sites)
            Check ($a.Allowed) 'Every sampled green-cell corner passes all filters'
        }
    }}
    Check ($checkedCells -gt 100) 'Meaningful mask sampling coverage'
} finally {$mask.Dispose()}
$options.Reserve=2300
$mask=[BakhmutMap.PositionPlanner]::CreateMask($table,$target,$options,$roads,$sites)
try {Check ($mask.Cells -eq 0) 'Impossible reserve returns empty mask'} finally {$mask.Dispose()}
$serializer=[Web.Script.Serialization.JavaScriptSerializer]::new()
$originals=$serializer.Deserialize((Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot 'data/maps/bakhmut/points.json')),[Collections.Generic.List[BakhmutMap.Site]])
$state=[BakhmutMap.Session]::new()
$state.Names.Add($originals[0].id,'Old alias')
$state.NamingVersion=1
[BakhmutMap.SiteNames]::ApplyScenarioNames($state,$originals)
$englishNames=@('Main base — South','Main base — North','trenchs','gym','church','residential sector','AZOM Factory','Forest','yahidne','opytne')
for($i=0;$i -lt 10;$i++) {Check ($state.Names[$originals[$i].id] -eq $englishNames[$i]) 'English scenario names replace previous numbering'}
$state.Names[$originals[0].id]='New custom alias'
[BakhmutMap.SiteNames]::ApplyScenarioNames($state,$originals)
Check ($state.Names[$originals[0].id] -eq 'New custom alias') 'One-time naming migration preserves later user edits'
$fixture=Join-Path $PSScriptRoot 'output/planning-session.json'
$state.Planning.SiteOffset=450;$state.Planning.RoadOffset=150;$state.Planning.Reserve=250;$state.Planning.Show=$true
[BakhmutMap.Storage]::Save($fixture,$state)
$restored=[BakhmutMap.Storage]::Load($fixture)
Check ($restored.Planning.SiteOffset -eq 450 -and $restored.Planning.RoadOffset -eq 150 -and $restored.Planning.Reserve -eq 250 -and $restored.Planning.Show -and $restored.NamingVersion -eq 2) 'Planning options and naming migration persist'
$legacy=$serializer.Deserialize('{"Version":1,"Names":{},"Bookmarks":[]}',[BakhmutMap.Session])
[BakhmutMap.Coordinates]::Validate($legacy)
Check ($legacy.Planning.Reserve -eq 200 -and $legacy.Planning.SiteOffset -eq 300) 'Legacy sessions receive planning defaults'
$watch=[Diagnostics.Stopwatch]::StartNew()
$realRoads=[BakhmutMap.RoadIndex]::Load((Join-Path $projectRoot 'data/maps/bakhmut/roads.json'))
Check ($realRoads.Count -eq 9426) 'Full decoded road polygons loaded'
$realMask=[BakhmutMap.PositionPlanner]::CreateMask($table,(Point 5637.116 3925.659),[BakhmutMap.PlanningOptions]::new(),$realRoads,$originals)
try {Check ($realMask.Cells -gt 0) 'Actual scenario target has candidates';Write-Output "Real map: $($realMask.Cells) cells, road load and mask $($watch.ElapsedMilliseconds) ms"} finally {$realMask.Dispose()}
Write-Output "$script:passed planning checks passed."
