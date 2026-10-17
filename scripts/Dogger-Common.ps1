# Shared helpers for the Dogger launcher (Start-Dogger.ps1) and local server (Serve-Dogger.ps1).
# Keep this file ASCII-only and written for Windows PowerShell 5.1 (built into Windows) as well as PowerShell 7.

# Never stop to ask for a password or a credential prompt: fail with a message instead.
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'

function Get-DoggerStateDir {
    $base = $env:LOCALAPPDATA
    if (-not $base) { $base = Join-Path $HOME '.local/share' }
    $dir = Join-Path $base 'Dogger'
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    return $dir
}

function Write-DoggerLogFile {
    param([string]$Path, [string]$Message)
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    try { Add-Content -LiteralPath $Path -Value $line -Encoding UTF8 } catch { }
}

function Write-DoggerStatus {
    param(
        [ValidateSet('step', 'ok', 'info', 'warn', 'error')][string]$Kind = 'info',
        [string]$Message
    )
    $color = 'Gray'
    if ($Kind -eq 'step') { $color = 'Cyan' }
    if ($Kind -eq 'ok') { $color = 'Green' }
    if ($Kind -eq 'warn') { $color = 'Yellow' }
    if ($Kind -eq 'error') { $color = 'Red' }
    Write-Host $Message -ForegroundColor $color
}

function Get-DoggerShortSha {
    param([string]$Sha)
    if ($Sha -and $Sha.Length -ge 7) { return $Sha.Substring(0, 7) }
    return $Sha
}

function Write-DoggerUtf8File {
    param([string]$Path, [string]$Text)
    [IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

# Runs git against a repository and returns exit code, output lines and trimmed text.
function Invoke-DoggerGit {
    param(
        [Parameter(Mandatory = $true)][string]$RepoPath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $raw = & git -C $RepoPath @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    $lines = @($raw | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
    return [pscustomobject]@{
        ExitCode = $code
        Lines    = $lines
        Text     = (($lines -join "`n").Trim())
    }
}

# Fetches only the Dogger branch into refs/remotes/<remote>/<branch>. Retries network hiccups.
function Invoke-DoggerFetch {
    param([string]$RepoPath, [string]$Remote, [string]$Branch)
    $refspec = '+refs/heads/{0}:refs/remotes/{1}/{0}' -f $Branch, $Remote
    $result = $null
    foreach ($wait in @(0, 2, 4)) {
        if ($wait -gt 0) { Start-Sleep -Seconds $wait }
        $result = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('fetch', '--quiet', '--no-tags', $Remote, $refspec)
        if ($result.ExitCode -eq 0) { break }
        if ($result.Text -match "couldn't find remote ref") { break }
    }
    return $result
}

# Paths with uncommitted changes (tracked edits, staged files and untracked files).
function Get-DoggerDirtyPaths {
    param([string]$RepoPath)
    $status = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('status', '--porcelain', '--untracked-files=all')
    $paths = New-Object System.Collections.Generic.List[string]
    foreach ($line in $status.Lines) {
        if ($line.Length -lt 4) { continue }
        $rest = $line.Substring(3).Trim('"')
        foreach ($part in ($rest -split ' -> ')) { $paths.Add($part.Trim('"')) }
    }
    return $paths.ToArray()
}

function New-DoggerSyncResult {
    return [pscustomobject]@{
        Status  = 'unknown'
        Message = ''
        Details = @()
        Before  = ''
        After   = ''
        Branch  = ''
        Commit  = ''
    }
}

# Writes version.json at the repository root with the checked-out commit. The browser compares
# this value to detect that the served build has changed. The file is git-ignored.
function Write-DoggerVersionFile {
    param([string]$RepoPath)
    $head = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', 'HEAD')
    $branch = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')
    if ($head.ExitCode -ne 0 -or $head.Text -notmatch '^[0-9a-f]{40}$') { return '' }
    $info = [ordered]@{
        app    = 'dogger'
        branch = $branch.Text
        commit = $head.Text
        short  = (Get-DoggerShortSha $head.Text)
    }
    $json = ConvertTo-Json -InputObject $info -Compress
    $path = Join-Path $RepoPath 'version.json'
    $current = ''
    if (Test-Path -LiteralPath $path) { $current = [IO.File]::ReadAllText($path) }
    if ($current -ne $json) { Write-DoggerUtf8File -Path $path -Text $json }
    return $head.Text
}

# The one place that changes the local checkout. Safe fast-forward only, never resets or deletes.
function Invoke-DoggerSyncLocked {
    param(
        [string]$RepoPath,
        [string]$Remote,
        [string]$Branch,
        [bool]$AllowSwitch,
        [bool]$NoFetch,
        $Result
    )

    $inside = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', '--is-inside-work-tree')
    if ($inside.ExitCode -ne 0) {
        $Result.Status = 'not-git'
        $Result.Message = "This folder is not a Git repository: $RepoPath"
        return
    }

    $beforeFull = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', 'HEAD')).Text
    $Result.Commit = $beforeFull
    $Result.Before = Get-DoggerShortSha $beforeFull
    $Result.Branch = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')).Text
    $trackRef = 'refs/remotes/{0}/{1}' -f $Remote, $Branch

    if (-not $NoFetch) {
        $fetch = Invoke-DoggerFetch -RepoPath $RepoPath -Remote $Remote -Branch $Branch
        if ($fetch.ExitCode -ne 0) {
            if ($fetch.Text -match "couldn't find remote ref") {
                $Result.Status = 'missing-branch'
                $Result.Message = "GitHub has no branch '$Branch' on remote '$Remote'."
            } else {
                $Result.Status = 'offline'
                $Result.Message = 'Could not reach GitHub to check for updates.'
                $Result.Details = @($fetch.Lines | Select-Object -First 2)
            }
            return
        }
    }

    $remoteHead = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', '--verify', '--quiet', $trackRef)).Text
    if (-not $remoteHead) {
        $Result.Status = 'missing-branch'
        $Result.Message = "No copy of branch '$Branch' from '$Remote' is available."
        return
    }

    $dirty = @(Get-DoggerDirtyPaths -RepoPath $RepoPath)

    if ($Result.Branch -ne $Branch) {
        if (-not $AllowSwitch -or $dirty.Count -gt 0) {
            $Result.Status = 'other-branch'
            $Result.Message = "This copy is on '$($Result.Branch)', not '$Branch', so it is not being updated."
            return
        }
        $hasLocal = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', '--verify', '--quiet', "refs/heads/$Branch")).ExitCode -eq 0
        if ($hasLocal) {
            $sw = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('switch', $Branch)
        } else {
            $sw = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('switch', '--track', '-c', $Branch, "$Remote/$Branch")
        }
        if ($sw.ExitCode -ne 0) {
            $Result.Status = 'error'
            $Result.Message = "Could not switch this copy to '$Branch'. Nothing was changed."
            $Result.Details = @($sw.Lines | Select-Object -First 3)
            return
        }
        $Result.Branch = $Branch
        $Result.Details += "Switched this copy to '$Branch'."
        $Result.Commit = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', 'HEAD')).Text
    }

    $counts = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-list', '--left-right', '--count', "HEAD...$trackRef")).Text -split '\s+'
    $ahead = [int]$counts[0]
    $behind = [int]$counts[1]

    if ($ahead -eq 0 -and $behind -eq 0) {
        $Result.Status = 'current'
        $Result.Message = "Up to date with GitHub ($(Get-DoggerShortSha $beforeFull))."
        return
    }

    if ($ahead -gt 0 -and $behind -gt 0) {
        $Result.Status = 'diverged'
        $Result.Message = 'Your local copy and GitHub both have new commits, so Dogger cannot update by itself. Nothing was changed.'
        $localOnly = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('log', '--oneline', '-5', "$trackRef..HEAD")).Lines
        $remoteOnly = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('log', '--oneline', '-5', "HEAD..$trackRef")).Lines
        $Result.Details = @('Only on this computer:') + @($localOnly | ForEach-Object { "  $_" }) + @('Only on GitHub:') + @($remoteOnly | ForEach-Object { "  $_" })
        return
    }

    if ($ahead -gt 0) {
        $Result.Status = 'ahead'
        $Result.Message = "Your local copy has $ahead commit(s) that GitHub does not have yet. Running your local version."
        return
    }

    # Behind only. Refuse if the update would touch a file that has local changes.
    $changed = @((Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('diff', '--name-only', 'HEAD', $trackRef)).Lines)
    $overlap = @($dirty | Where-Object { $changed -contains $_ })
    if ($overlap.Count -gt 0) {
        $Result.Status = 'blocked-local-changes'
        $Result.Message = "GitHub has $behind new commit(s), but these files have local changes. The update was skipped and nothing was changed."
        $Result.Details = @($overlap | ForEach-Object { "  $_" })
        return
    }

    $merge = Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('merge', '--ff-only', $trackRef)
    if ($merge.ExitCode -ne 0) {
        $Result.Status = 'error'
        $Result.Message = 'The fast-forward update failed. Git refused it, so nothing was changed.'
        $Result.Details = @($merge.Lines | Select-Object -First 3)
        return
    }

    $Result.Commit = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('rev-parse', 'HEAD')).Text
    $Result.After = Get-DoggerShortSha $Result.Commit
    $newCommits = (Invoke-DoggerGit -RepoPath $RepoPath -Arguments @('log', '--oneline', "$beforeFull..HEAD")).Lines
    $Result.Status = 'updated'
    $Result.Message = "$behind new commit(s) from GitHub."
    $Result.Details = @($newCommits | ForEach-Object { "  $_" })
}

# Public entry point: serialises updates with a named mutex so the launcher and the background
# server never run git at the same time, then reports what happened.
function Sync-DoggerRepo {
    param(
        [Parameter(Mandatory = $true)][string]$RepoPath,
        [string]$Remote = 'origin',
        [string]$Branch = 'claude/epic-einstein-mgwon8',
        [switch]$AllowSwitch,
        [switch]$NoFetch
    )
    $RepoPath = $RepoPath.TrimEnd('\', '/')
    $result = New-DoggerSyncResult
    $mutexName = 'Local\DoggerSync-' + ($RepoPath -replace '[^A-Za-z0-9]', '_')
    $mutex = New-Object System.Threading.Mutex($false, $mutexName)
    $held = $false
    try {
        try {
            $held = $mutex.WaitOne(60000)
        } catch [System.Threading.AbandonedMutexException] {
            $held = $true
        }
        if (-not $held) {
            $result.Status = 'busy'
            $result.Message = 'Another Dogger update is still running.'
            return $result
        }
        $null = Invoke-DoggerSyncLocked -RepoPath $RepoPath -Remote $Remote -Branch $Branch -AllowSwitch ([bool]$AllowSwitch) -NoFetch ([bool]$NoFetch) -Result $result
        $null = Write-DoggerVersionFile -RepoPath $RepoPath
        return $result
    } finally {
        if ($held) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Test-DoggerSamePath {
    param([string]$A, [string]$B)
    if (-not $A -or -not $B) { return $false }
    return ($A.TrimEnd('\', '/') -ieq $B.TrimEnd('\', '/'))
}

# Returns the status document of a Dogger server on this port, or $null.
function Get-DoggerServerStatus {
    param([int]$Port)
    try {
        $status = Invoke-RestMethod -Uri ('http://localhost:{0}/__dogger/status' -f $Port) -TimeoutSec 2 -UseBasicParsing
        if ($status.app -eq 'dogger') { return $status }
    } catch {
        return $null
    }
    return $null
}

# True when something accepts TCP connections on this port (Dogger or not).
function Test-DoggerPortOpen {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ready = $async.AsyncWaitHandle.WaitOne(500)
        return ($ready -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-DoggerServer {
    param([int]$Port, [int]$Seconds = 15)
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        $status = Get-DoggerServerStatus -Port $Port
        if ($status) { return $status }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)
    return $null
}

function Stop-DoggerServer {
    param($Status)
    Stop-Process -Id ([int]$Status.pid) -Force -ErrorAction SilentlyContinue
}

function Find-DoggerChrome {
    if ($env:DOGGER_CHROME -and (Test-Path -LiteralPath $env:DOGGER_CHROME)) { return $env:DOGGER_CHROME }
    $candidates = @()
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe') }
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe') }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    if ($env:OS -eq 'Windows_NT') {
        foreach ($hive in @('HKCU:', 'HKLM:')) {
            $item = Get-ItemProperty -Path "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
            if ($item -and $item.'(default)' -and (Test-Path -LiteralPath $item.'(default)')) { return $item.'(default)' }
        }
    }
    return $null
}

# Opens the URL in Chrome when it can be found, otherwise in the default browser. Returns which one.
function Open-DoggerBrowser {
    param([string]$Url)
    $chrome = Find-DoggerChrome
    if ($chrome) {
        Start-Process -FilePath $chrome -ArgumentList @('--new-window', $Url)
        return 'chrome'
    }
    Start-Process -FilePath $Url
    return 'default'
}
