$ErrorActionPreference = 'Stop'
function Get-Sha256([string] $Path) {
    $stream = [IO.File]::OpenRead($Path)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hasher.Dispose() }
}
$webRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$buildRoot = Join-Path $webRoot 'dist'
$reportPath = Join-Path $webRoot 'work/release-report.json'
if (-not (Test-Path -LiteralPath $reportPath)) { throw 'Run npm run verify:release first.' }
$report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
$actual = @(Get-ChildItem -LiteralPath $buildRoot -Recurse -File)
if ($actual.Count -ne $report.files.Count) { throw 'Build changed since acceptance. Run npm run verify:release again.' }
foreach ($entry in $report.files) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $buildRoot $entry.path))
    if (-not $candidate.StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid report path.' }
    if ((Get-Sha256 $candidate) -ne $entry.sha256) { throw "Build changed: $($entry.path). Repeat acceptance." }
}
$releaseName = 'web-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$outputRoot = Join-Path (Join-Path $webRoot '../dist') $releaseName
New-Item -ItemType Directory -Path $outputRoot | Out-Null
$archivePath = Join-Path $outputRoot 'luckymap-web.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($buildRoot, $archivePath, [IO.Compression.CompressionLevel]::Optimal, $false)
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $entries = @($archive.Entries | Where-Object { $_.Name -ne '' })
    if ($entries.Count -ne $report.files.Count) { throw 'Archive file count mismatch.' }
    foreach ($entry in $report.files) {
        $packed = $entries | Where-Object { $_.FullName.Replace('\', '/') -eq $entry.path }
        if (-not $packed) { throw "Missing archive entry: $($entry.path)" }
        $stream = $packed.Open()
        $hasher = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
        finally { $stream.Dispose(); $hasher.Dispose() }
        if ($hash -ne $entry.sha256) { throw "Archive content mismatch: $($entry.path)" }
    }
} finally { $archive.Dispose() }
Copy-Item -LiteralPath $reportPath -Destination (Join-Path $outputRoot 'release-report.json')
$archiveHash = Get-Sha256 $archivePath
"$archiveHash  luckymap-web.zip" | Set-Content -LiteralPath (Join-Path $outputRoot 'SHA256SUMS.txt') -Encoding ASCII
Write-Output "Verified archive: $archivePath"
Write-Output "SHA256: $archiveHash"
