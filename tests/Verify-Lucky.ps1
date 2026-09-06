param([string]$Binary='LuckyMap.exe')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
[void][Reflection.Assembly]::LoadFrom((Join-Path $root $Binary))
$out=Join-Path $PSScriptRoot 'output/lucky'
[void][IO.Directory]::CreateDirectory($out)
$script:passed=0
function Check($condition,$message){if(-not $condition){throw "FAILED: $message"};$script:passed++;Write-Output "PASS: $message"}
$form=[BakhmutMap.MainForm]::new($root)
try {
    $form.Show();$form.SetFullscreen($false,$false);[Windows.Forms.Application]::DoEvents()
    Check ($form.Fleet.Guns.Count -eq 1) 'One gun initially'
    $form.WeaponChoice.SelectedIndex=1;$form.TrajectoryChoice.SelectedIndex=1;$form.RingsChoice.SelectedItem=2
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(6285,2192));$form.SetPoint($false,[BakhmutMap.MapPoint]::new(5317.879,5346.81))
    Check ($form.CurrentSolution.Available -and $form.CurrentSolution.ElevationUnits -eq 198 -and $form.CurrentSolution.AzimuthUnits -eq 6097) 'Original game result preserved'
    $first=$form.CurrentSolution
    Check ($form.AddGun()) 'Add second gun'
    Check ($form.Fleet.ActiveId -eq 2 -and $null -eq $form.State.Position -and -not $form.CurrentSolution.Available) 'New gun has no invented position or stale result'
    Check ($form.State.Target.X -eq 5317.879) 'New gun receives a copy of current target'
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(6000,2200));$form.RingsChoice.SelectedItem=3
    $form.SetPoint($false,[BakhmutMap.MapPoint]::new(5400,5300))
    $second=$form.CurrentSolution
    $form.SelectGun(1)
    Check ($form.State.Position.X -eq 6285 -and $form.State.Target.X -eq 5317.879 -and $form.RingsChoice.SelectedItem -eq 2) 'First gun retains own position, target and charge'
    Check ($form.CurrentSolution.ElevationUnits -eq $first.ElevationUnits) 'Switch restores the first solution'
    $form.SelectGun(2)
    Check ($form.State.Position.X -eq 6000 -and $form.State.Target.X -eq 5400 -and $form.RingsChoice.SelectedItem -eq 3) 'Second gun retains own settings'
    Check ($form.CurrentSolution.ElevationUnits -eq $second.ElevationUnits) 'Switch restores the second solution'
    $form.AssignTargetToAll();$form.SelectGun(1)
    Check ($form.State.Target.X -eq 5400 -and $form.RingsChoice.SelectedItem -eq 2) 'Shared target keeps independent charge'
    $form.SetPoint($false,[BakhmutMap.MapPoint]::new(5317.879,5346.81));$form.SelectGun(2)
    Check ($form.State.Target.X -eq 5400) 'Individual target edits do not mutate another gun'
    while($form.Fleet.Guns.Count -lt 6){[void]$form.AddGun();$id=$form.Fleet.ActiveId;$form.SetPoint($true,[BakhmutMap.MapPoint]::new((6200+$id*35),(2100+$id*30)))}
    Check (-not $form.AddGun() -and $form.Fleet.Guns.Count -eq 6 -and -not $form.AddGunButton.Enabled) 'Maximum six guns enforced'
    $form.SelectGun(1)
    Check ($form.Map.GunMarkers.Count -eq 5 -and $form.Map.PositionCaption.StartsWith('A1')) 'Map shows all six gun identities'
    Check ($form.HelpTips.GetToolTip($form.RingsChoice).Contains('1L') -and $form.HelpTips.GetToolTip($form.PositionInput).Contains('Enter')) 'Tooltips explain charges and applying coordinates'
    $form.GetType().GetField('statePath',[Reflection.BindingFlags]'NonPublic,Instance').SetValue($form,(Join-Path $out 'session.json'))
    Check ($form.SaveState()) 'Save all guns to isolated test fixture'
    $loaded=[BakhmutMap.FleetState]::Load((Join-Path $out 'session.json'))
    Check ($loaded.Guns.Count -eq 6 -and $loaded.ActiveId -eq 1) 'Reload preserves six guns and selection'
    Check ($loaded.Guns[0].Data.Position.X -eq 6285 -and $loaded.Guns[1].Data.Target.X -eq 5400) 'Reload preserves distinct coordinates'
    Check ($loaded.Guns[0].Data.M777TableId -eq 'm777-2-low' -and $loaded.Guns[1].Data.M777TableId -eq 'm777-3-low') 'Reload preserves distinct charge profiles'
    $form.Map.CenterX=5670;$form.Map.CenterZ=3830;$form.Map.PixelsPerMetre=.13
    foreach($size in @(@(1440,960),@(1180,820))){
        $form.ClientSize=[Drawing.Size]::new($size[0],$size[1]);[Windows.Forms.Application]::DoEvents()
        $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
        try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save((Join-Path $out ("desktop-"+$size[0]+'.png')))}finally{$bitmap.Dispose()}
        Check ($form.Map.Width -gt 700 -and $form.Map.Height -gt 420) "Map usable at $($size[0])px"
        $trajectoryEdge=$form.PointToClient($form.TrajectoryChoice.PointToScreen([Drawing.Point]::new($form.TrajectoryChoice.Width,0)))
        Check ($trajectoryEdge.X -le $form.ClientSize.Width) "All calculation selectors fit at $($size[0])px"
        foreach($input in @($form.PositionInput,$form.TargetInput)){
            Check ($input.Bottom -le $input.Parent.ClientSize.Height -and $input.Top -ge 0) 'Coordinate text stays inside rounded field'
            $row=$input.Parent.Parent;$apply=@($row.Controls|Where-Object {$_ -is [Windows.Forms.Button]})[0]
            $format=if($input -eq $form.PositionInput){$form.PositionFormat}else{$form.TargetFormat}
            Check ($format.Bottom + $format.Margin.Bottom -le $row.Top) 'Coordinate format and entry row have a real gap'
            Check (-not $input.Parent.Bounds.IntersectsWith($apply.Bounds)) 'Coordinate field and Apply do not overlap'
            Check ($apply.Bottom -le $row.ClientSize.Height -and $apply.Right -le $row.ClientSize.Width) 'Apply stays inside its layout row'
        }
        Check ($form.CalculationTabs.Top -ge $form.Map.Bottom) 'Map cannot overlap calculation panel'
        $notice=$form.GetType().GetField('calculationNotice',[Reflection.BindingFlags]'NonPublic,Instance').GetValue($form)
        Check ($notice.Height -ge $notice.PreferredHeight) 'Calculation assumptions remain fully readable'
    }
    $form.WeaponChoice.DroppedDown=$true;[Windows.Forms.Application]::DoEvents()
    Check $form.WeaponChoice.DroppedDown 'Rounded selector still opens native dropdown'
    $form.WeaponChoice.DroppedDown=$false
    $form.Scale([Drawing.SizeF]::new(1.25,1.25));$form.ClientSize=[Drawing.Size]::new(1475,1025);[Windows.Forms.Application]::DoEvents()
    foreach($input in @($form.PositionInput,$form.TargetInput)){
        $row=$input.Parent.Parent;$format=if($input -eq $form.PositionInput){$form.PositionFormat}else{$form.TargetFormat}
        Check ($format.Bottom -le $row.Top) 'Coordinate rows do not overlap at 125% layout scale'
        Check ($input.Bottom -le $input.Parent.Height) 'Coordinate text fits at 125% layout scale'
    }
    $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save((Join-Path $out 'desktop-125percent.png'))}finally{$bitmap.Dispose()}
    $form.CalculationTabs.SelectedIndex=1;$form.ShowCandidates.Checked=$true
    Check ($null -ne $form.Map.Candidates) 'Planning works for selected gun'
    $form.CalculationTabs.SelectedIndex=0
    $form.SelectGun(2);$form.WeaponChoice.SelectedIndex=0
    $form.SelectGun(1);Check ($form.WeaponChoice.SelectedIndex -eq 1) 'Mixed weapon fleet remains independent'
    $form.SelectGun(2);Check ($form.WeaponChoice.SelectedIndex -eq 0) 'Mortar selection restored'
    Check ($form.RemoveActiveGun() -and $form.Fleet.Guns.Count -eq 5) 'Remove selected gun'
    [void]$form.AddGun();Check ($form.Fleet.ActiveId -eq 2 -and $form.Fleet.Guns.Count -eq 6) 'Reuses free ID without renumbering remaining guns'
    while($form.Fleet.Guns.Count -gt 1){[void]$form.RemoveActiveGun()}
    Check (-not $form.RemoveActiveGun() -and -not $form.RemoveGunButton.Enabled) 'Last gun cannot be removed'
    $bad=[BakhmutMap.FleetState]::new();$bad.Guns.Add([BakhmutMap.GunSlot]::new());$rejected=$false
    try{$bad.Validate()}catch{$rejected=$true};Check $rejected 'Malformed fleet is rejected'
    $mapPoint=[BakhmutMap.MapPoint]::new(5317.879,5346.81)
    $roundtrip=$form.Map.World($form.Map.Screen($mapPoint))
    Check ([BakhmutMap.Coordinates]::Distance($mapPoint,$roundtrip) -lt .01) 'World and screen coordinates remain aligned'
    $anchor=[Drawing.PointF]::new(300,200);$before=$form.Map.World($anchor);$form.Map.Zoom(1.3,$anchor)
    Check ([BakhmutMap.Coordinates]::Distance($before,$form.Map.World($anchor)) -lt .001) 'Zoom keeps coordinate under cursor'
}finally{$form.MarkCleanForVerification();$form.Close();$form.Dispose()}
foreach($file in (Get-Content (Join-Path $root 'app-lucky/original-hashes.json') -Raw|ConvertFrom-Json)){
    $source=Join-Path $root $file.Path
    if($file.Path -eq 'BakhmutMap.exe' -and -not (Test-Path -LiteralPath $source)){Write-Output 'SKIP: optional preserved classic binary is not present';continue}
    Check ((Get-FileHash -LiteralPath $source).Hash -eq $file.Hash) ("Classic unchanged: "+$file.Path)
}
Write-Output "$script:passed Lucky checks passed. User saves were not written."
