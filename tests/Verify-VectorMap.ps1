param([string]$Binary='LuckyMap-preview.exe')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[void][Reflection.Assembly]::LoadFrom((Join-Path $root $Binary))
$folder=Join-Path $root 'data/maps/bakhmut'
$out=Join-Path $PSScriptRoot 'output/lucky'
[void][IO.Directory]::CreateDirectory($out)
$layer=[BakhmutMap.VectorRoadLayer]::new((Join-Path $folder 'roads.json'))
$map=[BakhmutMap.MapCanvas]::new($folder)
$header=[BakhmutMap.LuckyHeader]::new((Join-Path $root 'references/mod-luckygames/scenario0_1024x512.jpg'))
$passed=0
try {
    if($layer.PolygonCount -ne 9426){throw 'Lost source polygons'};$passed++
    $json=Get-Content (Join-Path $folder 'roads.json') -Raw | ConvertFrom-Json
    $map.Size=[Drawing.Size]::new(128,128);$map.PixelsPerMetre=5
    # Render independent centroids from actual source polygons, spread across the dataset.
    foreach($i in 0..19){
        $road=$json.roads[$i*17];$q=$road.quads[[int][Math]::Floor($road.quads.Count/2)]
        $x=($q|ForEach-Object {$_[0]}|Measure-Object -Average).Average
        $z=($q|ForEach-Object {$_[1]}|Measure-Object -Average).Average
        $map.CenterX=$x;$map.CenterZ=$z
        $bitmap=[Drawing.Bitmap]::new(128,128);$graphics=[Drawing.Graphics]::FromImage($bitmap)
        try{$graphics.Clear([Drawing.Color]::Transparent);$layer.Draw($graphics,$map);if($bitmap.GetPixel(64,64).A -lt 240){throw "Source road centre moved: $x,$z"};$passed++}finally{$graphics.Dispose();$bitmap.Dispose()}
    }
    $map.Size=[Drawing.Size]::new(1000,700);$map.CenterX=4790;$map.CenterZ=5175;$map.PixelsPerMetre=4;$map.ShowRoads=$true;$map.ShowNames=$true;$map.ShowGrid=$true
    $map.Sites=[Collections.Generic.List[BakhmutMap.Site]]::new()
    $site=[BakhmutMap.Site]::new();$site.name='gym';$site.x=4761.093;$site.z=5193.727;$map.Sites.Add($site)
    $bitmap=[Drawing.Bitmap]::new(1000,700)
    try{$map.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,1000,700));$bitmap.Save((Join-Path $out 'vector-roads.png'))}finally{$bitmap.Dispose()}
    $style=$header.GetType().GetMethod('GetStyle',[Reflection.BindingFlags]'NonPublic,Instance')
    if(-not $style.Invoke($header,@([Windows.Forms.ControlStyles]::ResizeRedraw))){throw 'Header does not invalidate on resize'};$passed++
    foreach($width in @(1200,900,1350,1000)){$header.Size=[Drawing.Size]::new($width,64)}
    $bitmap=[Drawing.Bitmap]::new(1000,64)
    try{$header.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,1000,64));$bitmap.Save((Join-Path $out 'header-resized.png'))}finally{$bitmap.Dispose()}
    Write-Output "$passed vector geometry and header checks passed."
}finally{$layer.Dispose();$map.Dispose();$header.Dispose()}
