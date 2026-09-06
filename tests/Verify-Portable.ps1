param([string]$Version='1.0.0')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$name='LuckyMap-'+$Version+'-Windows'
$zip=Join-Path $root ('dist/'+$name+'.zip')
$extract=Join-Path $root ('dist/verify-'+[Guid]::NewGuid().ToString('N'))
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$archive=[IO.Compression.ZipFile]::OpenRead($zip)
try{
    $entries=@($archive.Entries|Where-Object {$_.Name})
    if($entries.Count -ne 112){throw "Unexpected archive file count: $($entries.Count)"}
    if(@($entries|Where-Object {$_.FullName -match '(^|/)(user-data|app|app-lucky|tools|tests|extracted)/|\.pak$|\.cs$'}).Count){throw 'Development or personal files in archive'}
}finally{$archive.Dispose()}
[IO.Compression.ZipFile]::ExtractToDirectory($zip,$extract)
$package=Join-Path $extract $name
if((Get-ChildItem -LiteralPath (Join-Path $package 'data/maps/bakhmut/detail/background') -File).Count -ne 100){throw 'Missing map tiles'}
if((Get-FileHash (Join-Path $package 'LuckyMap.exe')).Hash -ne (Get-FileHash (Join-Path $root 'dist/build/LuckyMap.exe')).Hash){throw 'Executable mismatch'}
Push-Location $package
try{
    [Windows.Forms.Application]::EnableVisualStyles()
    [void][Reflection.Assembly]::LoadFrom((Join-Path $package 'LuckyMap.exe'))
    $form=[BakhmutMap.MainForm]::new($package)
    try{
        $form.Show();[Windows.Forms.Application]::DoEvents()
        if(-not $form.IsFullscreen -or $form.Fleet.Guns.Count -ne 1){throw 'Fresh startup failed'}
        $form.SetFullscreen($false,$false);$form.SetLanguage('en',$false)
        $form.WeaponChoice.SelectedIndex=1;$form.TrajectoryChoice.SelectedIndex=1;$form.RingsChoice.SelectedItem=2;$form.ShellChoice.SelectedItem='M116 SMOKE'
        $form.SetPoint($true,[BakhmutMap.MapPoint]::new(6285,2192));$form.SetPoint($false,[BakhmutMap.MapPoint]::new(5317.879,5346.81))
        if(-not $form.CurrentSolution.Available -or $form.CurrentSolution.ElevationUnits -ne 198 -or $form.CurrentSolution.AzimuthUnits -ne 6097){throw 'Portable calculation failed'}
        $form.Map.CenterX=4790;$form.Map.CenterZ=5175;$form.Map.PixelsPerMetre=4
        [Windows.Forms.Application]::DoEvents()
        $bitmap=[Drawing.Bitmap]::new($form.Width,$form.Height)
        try{$form.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height));$bitmap.Save((Join-Path $extract 'portable-preview.png'))}finally{$bitmap.Dispose()}
        if(-not $form.SaveState() -or -not (Test-Path (Join-Path $package 'user-data/lucky-session.json'))){throw 'Portable save failed'}
        Write-Output 'Portable ZIP passed: clean contents, all tiles, matching EXE, fresh startup, fullscreen, English, M116 calculation, map rendering and local save.'
        Write-Output (Join-Path $extract 'portable-preview.png')
    }finally{$form.MarkCleanForVerification();$form.Dispose()}
}finally{Pop-Location}
