$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
[void][IO.Directory]::CreateDirectory((Join-Path $root 'tests/output/lucky'))
Add-Type -AssemblyName System.Windows.Forms
[void][Reflection.Assembly]::LoadFrom((Join-Path $root 'LuckyMap.exe'))
$form=[BakhmutMap.MainForm]::new($root)
try {
    $form.WeaponChoice.SelectedIndex=1
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(200,200))
    $tables=$form.GetType().GetField('gameTables',[Reflection.BindingFlags]'NonPublic,Instance').GetValue($form)
    foreach($table in @($tables | Where-Object {$_.shell -eq 'M116 SMOKE'})){
        $form.TrajectoryChoice.SelectedIndex= if($table.trajectory -eq 'low'){1}else{0}
        $form.ShellChoice.SelectedItem='M107 HE';$form.RingsChoice.SelectedItem=$table.rings
        $offset=($table.rows[0].distance+1)/[Math]::Sqrt(2)
        $form.SetPoint($false,[BakhmutMap.MapPoint]::new((200+$offset),(200+$offset)))
        $he=$form.CurrentSolution
        $form.ShellChoice.SelectedItem='M116 SMOKE'
        if($form.RingsChoice.SelectedItem -ne $table.rings){throw 'Shell change reset charge'}
        if($form.State.M777TableId -ne $table.id -or -not $form.CurrentSolution.Available -or $form.CurrentSolution.Elevation -ne $he.Elevation -or $form.CurrentSolution.Seconds -ne $he.Seconds){throw 'Inherited ballistic profile mismatch'}
    }
    if(@($tables | Where-Object {$_.shell -eq 'M116 SMOKE'}).Count -ne 10){throw 'Missing smoke profiles'}
    $saved=$form.State.M777TableId
    [void]$form.AddGun();$form.SelectGun(1)
    if($form.ShellChoice.SelectedItem -ne 'M116 SMOKE' -or $form.State.M777TableId -ne $saved){throw 'Gun switch lost smoke selection'}
    $path=Join-Path $root 'tests/output/lucky/smoke-session.json'
    $form.GetType().GetField('statePath',[Reflection.BindingFlags]'NonPublic,Instance').SetValue($form,$path)
    if(-not $form.SaveState()){throw 'Save failed'}
    $loaded=[BakhmutMap.FleetState]::Load($path)
    if($loaded.Guns[0].Data.M777TableId -ne $saved){throw 'Save lost smoke profile'}
    Write-Output 'Smoke: all 10 profiles, preserved charge, gun switching and saved selection passed.'
}finally{$form.MarkCleanForVerification();$form.Dispose()}
