$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
[void][IO.Directory]::CreateDirectory((Join-Path $root 'tests/output/lucky'))
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[void][Reflection.Assembly]::LoadFrom((Join-Path $root 'LuckyMap.exe'))
$folder=Join-Path $root 'data/maps/bakhmut'
$layer=[BakhmutMap.VectorBuildingLayer]::new((Join-Path $folder 'buildings.json'))
$map=[BakhmutMap.MapCanvas]::new($folder)
$bitmap=[Drawing.Bitmap]::new(128,128)
$graphics=[Drawing.Graphics]::FromImage($bitmap)
try {
    if($layer.PolygonCount -ne 9626){throw 'Source contour count mismatch'}
    $map.Size=[Drawing.Size]::new(128,128)
    # Independent landmark position read from CCenter.layer, not the decoded geometry.
    $map.CenterX=4723.68;$map.CenterZ=5218.409;$map.PixelsPerMetre=4
    $graphics.Clear([Drawing.Color]::Transparent);$layer.Draw($graphics,$map)
    if($bitmap.GetPixel(64,64).A -ne 255){throw 'Gym footprint does not cover its source entity position'}
    $map.PixelsPerMetre=0.1
    $graphics.Clear([Drawing.Color]::Transparent);$layer.Draw($graphics,$map)
    if($bitmap.GetPixel(64,64).A -ne 0){throw 'Overview is cluttered by detail layer'}
    $map.PixelsPerMetre=4;$map.ShowRoads=$false;$map.ShowGrid=$false;$map.ShowNames=$false
    $map.ShowBuildings=$true;$map.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,128,128));$on=$bitmap.GetPixel(64,64).ToArgb()
    $map.ShowBuildings=$false;$map.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,128,128));$off=$bitmap.GetPixel(64,64).ToArgb()
    if($on -eq $off){throw 'Building toggle does not change the map'}
    $point=$map.World([Drawing.PointF]::new(64,64))
    if([Math]::Abs($point.X-4723.68) -gt 0.001 -or [Math]::Abs($point.Z-5218.409) -gt 0.001){throw 'Layer changed coordinates'}
    Write-Output '5 building checks passed: count, independent landmark, zoom visibility, toggle, coordinates.'
}finally{$graphics.Dispose();$bitmap.Dispose();$layer.Dispose();$map.Dispose()}
