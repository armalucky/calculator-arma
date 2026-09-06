$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[void][Reflection.Assembly]::LoadFrom((Join-Path $root 'BakhmutMap.exe'))
$folder=Join-Path $root 'data/maps/bakhmut'
$map=[BakhmutMap.MapCanvas]::new($folder)
$map.Size=[Drawing.Size]::new(1024,768)
$map.ShowRoads=$false;$map.ShowGrid=$false;$map.ShowNames=$false
$out=Join-Path $PSScriptRoot 'output'
[void][IO.Directory]::CreateDirectory($out)
$count=0
try {
    # Cross both tile seams, then check the north-west and south-east map edges.
    foreach($centre in @(@(5120,5120),@(512,9856),@(9728,384))) {
        $map.CenterX=$centre[0];$map.CenterZ=$centre[1];$map.PixelsPerMetre=1
        $bitmap=[Drawing.Bitmap]::new(1024,768)
        $sources=@{}
        try {
            $map.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,1024,768))
            foreach($x in @(0,1,127,511,512,513,767,1022,1023)) {
                foreach($y in @(55,127,383,384,385,511,650)) {
                    $world=$map.World([Drawing.PointF]::new($x,$y))
                    $sx=[int]$world.X;$sy=[int](10240-$world.Z)
                    $tx=[int][Math]::Floor($sx/1024);$ty=[int][Math]::Floor($sy/1024)
                    $key="$tx`_$ty"
                    if(-not $sources.ContainsKey($key)) {$sources[$key]=[Drawing.Bitmap]::new((Join-Path $folder "detail/background/$key.png"))}
                    $expected=$sources[$key].GetPixel(($sx%1024)+1,($sy%1024)+1)
                    $actual=$bitmap.GetPixel($x,$y)
                    if($actual.ToArgb() -ne $expected.ToArgb()) {throw "Raster registration mismatch at $sx,$sy : $actual vs $expected"}
                    $count++
                }
            }
        } finally {$bitmap.Dispose();foreach($s in $sources.Values){$s.Dispose()}}
    }
    $map.CenterX=5200;$map.CenterZ=5100;$map.PixelsPerMetre=2;$map.ShowGrid=$true;$map.ShowRoads=$true
    $bitmap=[Drawing.Bitmap]::new(1024,768)
    try {$map.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,1024,768));$bitmap.Save((Join-Path $out 'map-detail.png'))}finally{$bitmap.Dispose()}
    $map.ShowRoads=$false
    # Exercise eviction by panning across the entire map.
    foreach($x in 0..9) {
        $map.CenterX=$x*1024+512
        $bitmap=[Drawing.Bitmap]::new(1024,768)
        try {$map.DrawToBitmap($bitmap,[Drawing.Rectangle]::new(0,0,1024,768))}finally{$bitmap.Dispose()}
    }
    $cache=$map.GetType().GetField('detailCache',[Reflection.BindingFlags]'NonPublic,Instance').GetValue($map)
    if($cache.Count -gt 24){throw 'Unbounded tile cache'}
    Write-Output "$count exact rendered-pixel checks passed at tile seams and map edges; cache bounded to 24 tiles."
} finally {$map.Dispose()}
