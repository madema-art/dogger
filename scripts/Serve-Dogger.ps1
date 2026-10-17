# Local Dogger server. Serves the repository folder on localhost and keeps it current with GitHub
# in the background (safe fast-forward only, same rules as the launcher).
#
# Started hidden by Start-Dogger.ps1. Stop it with:  Start-Dogger.bat -Stop
# Log file: %LOCALAPPDATA%\Dogger\serve.log
#
# Endpoints:
#   /                    the game (index.html)
#   /version.json        the commit that is checked out (the browser compares this)
#   /__dogger/status     JSON that the launcher uses to confirm the server is ready
# Keep this file ASCII-only and compatible with Windows PowerShell 5.1.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$SyncSeconds = 120,
    [string]$Branch = 'claude/epic-einstein-mgwon8',
    [string]$Remote = 'origin'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Dogger-Common.ps1')

$Root = $Root.TrimEnd('\', '/')
$logPath = Join-Path (Get-DoggerStateDir) 'serve.log'
$startedAt = (Get-Date).ToString('s')
$script:lastSyncStatus = ''

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
}

function Write-ServeLog {
    param([string]$Message)
    Write-DoggerLogFile -Path $logPath -Message $Message
}

function Send-ServeBytes {
    param($Response, [int]$Status, [string]$ContentType, [byte[]]$Bytes, [bool]$HeadOnly)
    $Response.StatusCode = $Status
    $Response.ContentType = $ContentType
    $Response.ContentLength64 = $Bytes.Length
    if (-not $HeadOnly) {
        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    }
}

function Send-ServeText {
    param($Response, [int]$Status, [string]$ContentType, [string]$Text, [bool]$HeadOnly)
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    Send-ServeBytes -Response $Response -Status $Status -ContentType $ContentType -Bytes $bytes -HeadOnly $HeadOnly
}

function Get-ServeStatusJson {
    $commit = ''
    $versionFile = Join-Path $Root 'version.json'
    if (Test-Path -LiteralPath $versionFile) {
        try { $commit = [string](Get-Content -Raw -LiteralPath $versionFile | ConvertFrom-Json).commit } catch { }
    }
    $body = [ordered]@{
        app       = 'dogger'
        pid       = $PID
        port      = $Port
        root      = $Root
        commit    = $commit
        startedAt = $startedAt
    }
    return (ConvertTo-Json -InputObject $body -Compress)
}

function Invoke-ServeRequest {
    param($Context)
    $request = $Context.Request
    $response = $Context.Response
    $response.Headers.Set('Cache-Control', 'no-store')
    $response.Headers.Set('X-Dogger-Server', '1')

    $headOnly = ($request.HttpMethod -eq 'HEAD')
    if ($request.HttpMethod -ne 'GET' -and -not $headOnly) {
        Send-ServeText -Response $response -Status 405 -ContentType 'text/plain; charset=utf-8' -Text 'Method not allowed' -HeadOnly $false
        return
    }

    $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)
    if ($path -eq '/__dogger/status') {
        Send-ServeText -Response $response -Status 200 -ContentType 'application/json; charset=utf-8' -Text (Get-ServeStatusJson) -HeadOnly $headOnly
        return
    }

    $relative = $path.TrimStart('/')
    if ($relative -eq '') { $relative = 'index.html' }
    $segments = $relative.Split('/')
    if ($segments -contains '.git') {
        Send-ServeText -Response $response -Status 404 -ContentType 'text/plain; charset=utf-8' -Text 'Not found' -HeadOnly $headOnly
        return
    }

    $full = [IO.Path]::GetFullPath((Join-Path $Root ($relative.Replace('/', [IO.Path]::DirectorySeparatorChar))))
    $prefix = $Root + [IO.Path]::DirectorySeparatorChar
    $inside = $full.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
    if (-not $inside -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Send-ServeText -Response $response -Status 404 -ContentType 'text/plain; charset=utf-8' -Text 'Not found' -HeadOnly $headOnly
        return
    }

    $extension = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $contentType = 'application/octet-stream'
    if ($mimeTypes.ContainsKey($extension)) { $contentType = $mimeTypes[$extension] }
    $bytes = [IO.File]::ReadAllBytes($full)
    Send-ServeBytes -Response $response -Status 200 -ContentType $contentType -Bytes $bytes -HeadOnly $headOnly
}

function Invoke-ServeSync {
    try {
        $result = Sync-DoggerRepo -RepoPath $Root -Remote $Remote -Branch $Branch
    } catch {
        Write-ServeLog ("Background update check failed: {0}" -f $_.Exception.Message)
        return
    }
    if ($result.Status -eq 'updated') {
        Write-ServeLog ("Updated {0} -> {1} from GitHub ({2})" -f $result.Before, $result.After, $result.Message)
        foreach ($line in $result.Details) { Write-ServeLog $line }
    }
    if ($result.Status -ne $script:lastSyncStatus) {
        Write-ServeLog ("Update check: {0} {1}" -f $result.Status, $result.Message)
        $script:lastSyncStatus = $result.Status
    }
}

# ---- start ----

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add(('http://localhost:{0}/' -f $Port))
try {
    $listener.Start()
} catch {
    Write-ServeLog ("Could not listen on port {0}: {1}" -f $Port, $_.Exception.Message)
    exit 3
}

$null = Write-DoggerVersionFile -RepoPath $Root
Write-ServeLog ("Serving {0} at http://localhost:{1}/ (pid {2}, update check every {3}s)" -f $Root, $Port, $PID, $SyncSeconds)

$lastSync = Get-Date
while ($true) {
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(1000)) {
        if (((Get-Date) - $lastSync).TotalSeconds -ge $SyncSeconds) {
            $lastSync = Get-Date
            Invoke-ServeSync
        }
    }
    $context = $task.Result
    try {
        Invoke-ServeRequest -Context $context
    } catch {
        Write-ServeLog ("Request failed: {0}" -f $_.Exception.Message)
    } finally {
        try { $context.Response.Close() } catch { }
    }
}
