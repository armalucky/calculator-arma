$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
[void][IO.Directory]::CreateDirectory((Join-Path $root 'tests/output/lucky'))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
[void][Reflection.Assembly]::LoadFrom((Join-Path $root 'LuckyMap.exe'))
$form=[BakhmutMap.MainForm]::new($root)
function Controls($parent){foreach($c in $parent.Controls){$c;Controls $c}}
try {
    $form.Show();$form.SetFullscreen($false,$false);$form.SetLanguage('ru',$false)
    $form.WeaponChoice.SelectedIndex=1;$form.TrajectoryChoice.SelectedIndex=1;$form.RingsChoice.SelectedItem=2;$form.ShellChoice.SelectedItem='M116 SMOKE'
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(6285,2192));$form.SetPoint($false,[BakhmutMap.MapPoint]::new(5317.879,5346.81))
    $before=$form.CurrentSolution;$profile=$form.State.M777TableId
    $form.PositionInput.Text='6285 2200'
    $form.SetLanguage('en',$false);[Windows.Forms.Application]::DoEvents()
    if($form.LanguageChoice.SelectedIndex -ne 1 -or $form.CalculationTabs.TabPages[0].Text -ne 'Calculation'){throw 'English selector/tab failed'}
    if($form.WeaponChoice.GetItemText($form.WeaponChoice.SelectedItem) -ne 'M777'){throw ('Combo display not localized: '+$form.WeaponChoice.GetItemText($form.WeaponChoice.SelectedItem)+' format='+$form.WeaponChoice.FormattingEnabled)}
    if($form.PositionInput.Text -ne '6285 2200' -or $form.State.Position.Z -ne 2192){throw 'Language switch changed pending input or applied coordinates'}
    if($form.CurrentSolution.Elevation -ne $before.Elevation -or $form.State.M777TableId -ne $profile){throw 'Language changed ballistic selection'}
    if($form.HelpTips.GetToolTip($form.RingsChoice) -notlike 'M777:*'){throw 'English tooltip missing'}
    $controls=@(Controls $form)
    foreach($c in $controls){
        if(($c -is [Windows.Forms.Label] -or $c -is [Windows.Forms.Button] -or $c -is [Windows.Forms.CheckBox] -or $c -is [Windows.Forms.TabPage]) -and $c.Text -match '[А-Яа-яЁё]'){throw "Untranslated control: $($c.Text)"}
    }
    [void]$form.AddGun();$form.SelectGun(1)
    if($form.ShellChoice.SelectedItem -ne 'M116 SMOKE' -or $form.RemoveGunButton.Text -ne 'Remove'){throw 'New controls or gun switch lost language'}
    foreach($size in @(@(1440,960),@(1180,820))){
        $form.ClientSize=[Drawing.Size]::new($size[0],$size[1]);[Windows.Forms.Application]::DoEvents()
        $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
        try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save((Join-Path $root ("tests/output/lucky/english-"+$size[0]+'.png')))}finally{$bitmap.Dispose()}
        if($form.Map.Width -lt 700){throw 'Language picker reduced map width'}
    }
    $form.SetLanguage('ru',$false)
    if($form.CalculationTabs.TabPages[0].Text -ne 'Расчёт' -or $form.RemoveGunButton.Text -ne 'Убрать'){throw 'Russian restoration failed'}
    $form.LanguageSettingsPath=Join-Path $root 'tests/output/lucky/language.txt'
    $form.SetLanguage('en',$true)
    if([IO.File]::ReadAllText($form.LanguageSettingsPath) -ne 'en'){throw 'Preference not saved'}
    $form.CalculationTabs.SelectedIndex=1;[Windows.Forms.Application]::DoEvents()
    $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save((Join-Path $root 'tests/output/lucky/english-planning.png'))}finally{$bitmap.Dispose()}
    Write-Output 'Language checks passed: RU/EN, captions, combos, tips, pending input, coordinates, smoke, gun switching, preference and layout.'
}finally{$form.MarkCleanForVerification();$form.Dispose()}
