$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[void][Reflection.Assembly]::LoadFrom((Join-Path $projectRoot 'BakhmutMap.exe'))
$outputDir = Join-Path $PSScriptRoot 'output'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$script:passed = 0
function Assert-True($condition, $description) {
    if (-not $condition) { throw "FAILED: $description" }
    $script:passed++
    Write-Output "PASS: $description"
}
function Assert-Rejected($text, $grid) {
    $rejected = $false
    try { [void][BakhmutMap.Coordinates]::Parse($text, $grid) } catch { $rejected = $true }
    Assert-True $rejected "Reject invalid input: $text"
}
$p = [BakhmutMap.Coordinates]::Parse('051 094', $true)
Assert-True ($p.X -eq 5150 -and $p.Z -eq 9450) 'Grid inputs select cell centre'
$edge = [BakhmutMap.Coordinates]::Parse('102 102', $true)
Assert-True ($edge.X -eq 10220 -and $edge.Z -eq 10220) 'Edge cell clips to actual map bounds'
$exact = [BakhmutMap.Coordinates]::Parse('5192,2 9404.3', $false)
Assert-True ([Math]::Abs($exact.X - 5192.2) -lt 0.001) 'Exact coordinates accept decimal separators'
Assert-Rejected 'NaN 100' $false
Assert-Rejected 'Infinity 100' $false
Assert-Rejected '-1 100' $false
Assert-Rejected '10241 100' $false
Assert-Rejected '051.2 094' $true
Assert-Rejected '051' $true
$saved = [BakhmutMap.Session]::new()
$saved.Position = [BakhmutMap.MapPoint]::new(5192.207792207792,9404.310344827587)
$saved.Target = [BakhmutMap.MapPoint]::new(6091.538461538462,9328.97435897436)
$saved.Names.Add('test-id', 'Тестовое имя')
$fixture = Join-Path $outputDir 'session.json'
[BakhmutMap.Storage]::Save($fixture, $saved)
$restored = [BakhmutMap.Storage]::Load($fixture)
Assert-True ($restored.Names['test-id'] -eq 'Тестовое имя' -and $restored.Target.X -eq $saved.Target.X) 'Session preserves names and exact coordinates'
[BakhmutMap.Storage]::Save($fixture, $saved)
Assert-True (Test-Path -LiteralPath ($fixture + '.bak')) 'Atomic save keeps previous version'
Assert-True ([Math]::Abs([BakhmutMap.Coordinates]::Distance($saved.Position,$saved.Target)-902.4805613) -lt 0.001) 'Recorded game-map distance reproduced'
$form = [BakhmutMap.MainForm]::new($projectRoot)
try {
    $form.Show()
    [Windows.Forms.Application]::DoEvents()
    $map = $form.Map
    $map.Fit()
    $screenPoint = $map.Screen($saved.Position)
    $roundtrip = $map.World($screenPoint)
    Assert-True ([BakhmutMap.Coordinates]::Distance($roundtrip,$saved.Position) -lt 0.01) 'Map coordinate conversion round trip'
    $mouseMethod = $map.GetType().GetMethod('OnMouseDown', [Reflection.BindingFlags]'NonPublic,Instance')
    $map.Mode = 'position'
    $mouseMethod.Invoke($map, @([Windows.Forms.MouseEventArgs]::new([Windows.Forms.MouseButtons]::Left,1,[int]$screenPoint.X,[int]$screenPoint.Y,0))) | Out-Null
    Assert-True ($null -ne $form.State.Position) 'Left click in position mode sets A'
    $map.Mode = 'target'
    $targetScreen = $map.Screen($saved.Target)
    $mouseMethod.Invoke($map, @([Windows.Forms.MouseEventArgs]::new([Windows.Forms.MouseButtons]::Left,1,[int]$targetScreen.X,[int]$targetScreen.Y,0))) | Out-Null
    Assert-True ($null -ne $form.State.Target) 'Left click in target mode sets B'
    $anchor = [Drawing.PointF]::new(300,300)
    $before = $map.World($anchor)
    $map.Zoom(1.3,$anchor)
    $after = $map.World($anchor)
    Assert-True ([BakhmutMap.Coordinates]::Distance($before,$after) -lt 0.001) 'Wheel zoom preserves coordinate under cursor'
    $beforeCentre = $map.CenterX
    $map.Mode = 'move'
    $mouseMethod.Invoke($map, @([Windows.Forms.MouseEventArgs]::new([Windows.Forms.MouseButtons]::Left,1,300,300,0))) | Out-Null
    $moveMethod = $map.GetType().GetMethod('OnMouseMove', [Reflection.BindingFlags]'NonPublic,Instance')
    $moveMethod.Invoke($map, @([Windows.Forms.MouseEventArgs]::new([Windows.Forms.MouseButtons]::Left,1,350,300,0))) | Out-Null
    $upMethod = $map.GetType().GetMethod('OnMouseUp', [Reflection.BindingFlags]'NonPublic,Instance')
    $upMethod.Invoke($map, @([Windows.Forms.MouseEventArgs]::new([Windows.Forms.MouseButtons]::Left,1,350,300,0))) | Out-Null
    Assert-True ($map.CenterX -lt $beforeCentre) 'Drag pans map in expected direction'
    $form.SetPoint($true,$saved.Position)
    $form.SetPoint($false,$saved.Target)
    $form.PositionFormat.SelectedIndex=1
    $form.TargetFormat.SelectedIndex=1
    $form.ShellChoice.SelectedIndex=0
    $form.WeaponChoice.SelectedIndex=0
    $form.RingsChoice.SelectedItem=4
    Assert-True ($form.CurrentSolution.Available -and $form.CurrentSolution.ElevationUnits -eq 1310) 'Map pair updates game calculation'
    $form.RingsChoice.SelectedItem=0
    Assert-True (-not $form.CurrentSolution.Available -and $form.SolutionText.Text -notmatch '1310') 'Out-of-range rings clear previous solution'
    $form.ShellChoice.SelectedIndex=2
    Assert-True ($form.RingsChoice.Items.Count -eq 2 -and $form.RingsChoice.Items.Contains(3) -and $form.RingsChoice.Items.Contains(4)) 'Missing illumination pages are unavailable'
    $form.ShellChoice.SelectedIndex=0
    $form.RingsChoice.SelectedItem=4
    Assert-True ($form.CurrentSolution.Available -and $form.State.TableId -eq 'he4') 'Returning to supported selection recalculates and records choice'
    $map.FramePair()
    [Windows.Forms.Application]::DoEvents()
    $bitmap = [Drawing.Bitmap]::new($form.Width,$form.Height)
    try {
        $form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height))
        $bitmap.Save((Join-Path $outputDir 'desktop-pair.png'),[Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }
    $form.CalculationTabs.SelectedIndex=1
    $form.ShowCandidates.Checked=$true
    $form.SetPoint($false,[BakhmutMap.MapPoint]::new(5637.116,3925.659))
    Assert-True ($null -ne $map.Candidates -and $map.Candidates.Cells -gt 0) 'Planning overlay follows target'
    $form.WeaponChoice.SelectedIndex=1
    $form.TrajectoryChoice.SelectedIndex=1
    $form.RingsChoice.SelectedItem=2
    Assert-True ($form.CurrentSolution.Available -and $null -ne $map.Candidates -and $form.State.WeaponId -eq 'm777' -and $form.CurrentSolution.UnitsPerCircle -eq 6400) 'M777 uses own tables and planning area'
    Assert-True ($form.ShellChoice.Items.Count -eq 1 -and $form.ShellChoice.SelectedItem -eq 'M107 HE' -and $form.RingsChoice.Items.Count -eq 5) 'M777 offers correct shell and five charges'
    $lowElevation=$form.CurrentSolution.Elevation
    $form.TrajectoryChoice.SelectedIndex=0
    Assert-True ($form.CurrentSolution.Available -and $form.CurrentSolution.Elevation -gt $lowElevation) 'M777 trajectory switch changes solution'
    $form.TrajectoryChoice.SelectedIndex=1
    Assert-True ($form.State.M777TableId -eq 'm777-2-low' -and $form.State.TableId -eq 'he4') 'Separate weapon selections retained'
    $form.CalculationTabs.SelectedIndex=0
    [Windows.Forms.Application]::DoEvents()
    $pendingBitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try {
        $form.DrawToBitmap($pendingBitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height))
        $pendingBitmap.Save((Join-Path $outputDir 'desktop-m777.png'),[Drawing.Imaging.ImageFormat]::Png)
    } finally {$pendingBitmap.Dispose()}
    $form.WeaponChoice.SelectedIndex=0
    $form.CalculationTabs.SelectedIndex=1
    Assert-True ($null -ne $map.Candidates -and $map.Candidates.Cells -gt 0) 'Returning to mortar restores its planning area'
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(5637.116,3925.659))
    Assert-True (-not $form.Assessment.SiteAllowed) 'UI excludes position at scenario point'
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(7000,4000))
    $map.CenterX=5637.116;$map.CenterZ=3925.659;$map.PixelsPerMetre=0.12
    [Windows.Forms.Application]::DoEvents()
    $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try {
        $form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height))
        $bitmap.Save((Join-Path $outputDir 'desktop-planning.png'),[Drawing.Imaging.ImageFormat]::Png)
    } finally {$bitmap.Dispose()}
    $form.ReserveInput.Value=2300
    Assert-True ($map.Candidates.Cells -eq 0) 'Impossible reserve clears overlay'
    $form.ShowCandidates.Checked=$false
    Assert-True ($null -eq $map.Candidates) 'Overlay switch removes cached image'
    $map.Fit()
    [Windows.Forms.Application]::DoEvents()
    $bitmap = [Drawing.Bitmap]::new($form.Width,$form.Height)
    try {
        $form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height))
        $bitmap.Save((Join-Path $outputDir 'desktop-overview.png'),[Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }
} finally {
    $form.MarkCleanForVerification()
    $form.Close()
    $form.Dispose()
}
Write-Output "$script:passed desktop checks passed. User session not modified."
