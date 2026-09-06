param([ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version='1.0.0')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$dist=Join-Path $root 'dist'
$package=Join-Path $dist ('LuckyMap-'+$Version+'-Windows')
$zip=$package+'.zip'
if((Test-Path -LiteralPath $package) -or (Test-Path -LiteralPath $zip)){throw 'This package already exists. Use a new version or remove the previous build explicitly.'}
[void][IO.Directory]::CreateDirectory((Join-Path $dist 'build'))
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'app-lucky/Build.ps1') -OutputName 'dist/build/LuckyMap.exe'
if($LASTEXITCODE -ne 0){throw 'Release build failed'}
[void][IO.Directory]::CreateDirectory($package)
Copy-Item -LiteralPath (Join-Path $dist 'build/LuckyMap.exe') -Destination (Join-Path $package 'LuckyMap.exe')
$files=@('LICENSE','LICENSE.ru.md','data/game-tables.json','data/m777-tables.json','data/maps/bakhmut/desktop-background.jpg','data/maps/bakhmut/roads.json','data/maps/bakhmut/buildings.json','data/maps/bakhmut/points.json','references/mod-luckygames/scenario0_1024x512.jpg')
foreach($x in 0..9){foreach($y in 0..9){$files+=('data/maps/bakhmut/detail/background/'+$x+'_'+$y+'.png')}}
foreach($relative in $files){
    $source=Join-Path $root $relative
    if(-not (Test-Path -LiteralPath $source -PathType Leaf)){throw "Missing runtime file: $relative"}
    $destination=Join-Path $package $relative
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
    Copy-Item -LiteralPath $source -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $root 'docs/PORTABLE-README.txt') -Destination (Join-Path $package 'README.txt')
[IO.File]::WriteAllText((Join-Path $package 'VERSION.txt'),$Version+[Environment]::NewLine)
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($package,$zip,[IO.Compression.CompressionLevel]::Optimal,$true)
$hash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $dist 'SHA256SUMS.txt'),$hash+'  '+[IO.Path]::GetFileName($zip)+[Environment]::NewLine)
Write-Output $zip
Write-Output ('SHA256: '+$hash)
