$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
[void][IO.Directory]::CreateDirectory((Join-Path $root 'tests/output/lucky'))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
[void][Reflection.Assembly]::LoadFrom((Join-Path $root 'LuckyMap.exe'))
$form=[BakhmutMap.MainForm]::new($root)
$fixture=Join-Path $root ('tests/output/lucky/window-mode-'+[Guid]::NewGuid().ToString('N')+'.txt')
$form.WindowModeSettingsPath=$fixture
function Key($key){
    $method=$form.GetType().GetMethod('ProcessCmdKey',[Reflection.BindingFlags]'Instance,NonPublic,DeclaredOnly')
    $args=@([Windows.Forms.Message]::new(),[Windows.Forms.Keys]$key)
    if(-not $method.Invoke($form,$args)){throw "Key not handled: $key"}
    [Windows.Forms.Application]::DoEvents()
}
try{
    $form.Show();[Windows.Forms.Application]::DoEvents()
    if(-not $form.IsFullscreen -or $form.FormBorderStyle -ne 'None'){throw 'First launch is not borderless fullscreen'}
    $screen=[Windows.Forms.Screen]::FromControl($form)
    if($form.Bounds -ne $screen.Bounds){throw 'Fullscreen does not cover the entire monitor including taskbar area'}
    if($form.TopMost){throw 'Fullscreen must not trap other applications'}
    $form.SetFullscreen($false,$false);$form.Bounds=[Drawing.Rectangle]::new(25,25,1200,850)
    $normal=$form.Bounds;$minimum=$form.MinimumSize
    $form.SetPoint($true,[BakhmutMap.MapPoint]::new(6285,2192));$form.SetPoint($false,[BakhmutMap.MapPoint]::new(5317.879,5346.81))
    $form.PositionInput.Text='6285 2200';$mapCenter=$form.Map.CenterX;$mapZoom=$form.Map.PixelsPerMetre
    Key F11
    if(-not $form.IsFullscreen -or [IO.File]::ReadAllText($fixture) -ne 'fullscreen'){throw 'F11 or fullscreen preference failed'}
    if($form.PositionInput.Text -ne '6285 2200' -or $form.State.Position.Z -ne 2192 -or $form.Map.CenterX -ne $mapCenter -or $form.Map.PixelsPerMetre -ne $mapZoom){throw 'Mode changed input, coordinates or map view'}
    $form.SetLanguage('en',$false)
    if($form.FullscreenButton.AccessibleName -ne 'Windowed mode · F11 / Esc'){throw 'English mode control missing'}
    $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
    try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save((Join-Path $root 'tests/output/lucky/fullscreen.png'))}finally{$bitmap.Dispose()}
    Key Escape
    if($form.IsFullscreen -or $form.FormBorderStyle -ne 'Sizable' -or $form.Bounds -ne $normal -or $form.MinimumSize -ne $minimum){throw 'Escape did not restore window geometry'}
    if([IO.File]::ReadAllText($fixture) -ne 'windowed'){throw 'Windowed preference not saved'}
    $form.FullscreenButton.PerformClick();$form.FullscreenButton.PerformClick()
    if($form.IsFullscreen){throw 'Button roundtrip failed'}
    $form.WindowState='Maximized';[Windows.Forms.Application]::DoEvents()
    $form.SetFullscreen($true,$false);$form.SetFullscreen($false,$false)
    if($form.WindowState -ne 'Maximized'){throw 'Maximized state lost'}
    $form.GetType().GetMethod('ApplySavedWindowMode',[Reflection.BindingFlags]'NonPublic,Instance').Invoke($form,@())
    if($form.IsFullscreen){throw 'Saved windowed mode not restored'}
    Write-Output 'Window mode checks passed: startup, full monitor, F11, Escape, button, restore geometry/maximized state, language, preference, coordinates and pending input.'
}finally{$form.MarkCleanForVerification();$form.Dispose()}
