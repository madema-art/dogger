# Dogger launcher. Normally started by Start-Dogger.bat (double-click).
#
#   1. Checks GitHub for the newest commit on the Dogger development branch.
#   2. Fast-forwards the local copy when that is safe. Never overwrites or deletes local work.
#   3. Starts the local server (or reuses the one already running) and checks that it answers.
#   4. Opens Dogger in Chrome.
#
# Options (normally not needed):
#   -Stop                    stop the local Dogger server
#   -NoUpdate                skip the GitHub check and run the local copy as it is
#   -NoBrowser               do not open a browser
#   -CreateDesktopShortcut   put a "Dogger" shortcut for Start-Dogger.bat on the desktop
#   -Port <n>                prefer this port (default 8765, falling back to 8766-8774)
#   -Branch / -Remote        override the branch or remote to follow
# Keep this file ASCII-only and compatible with Windows PowerShell 5.1.

[CmdletBinding()]
param(
    [switch]$Stop,
    [switch]$NoUpdate,
    [switch]$NoBrowser,
    [switch]$NoPause,
    [switch]$CreateDesktopShortcut,
    [int]$Port = 0,
    [string]$Branch = 'claude/epic-einstein-mgwon8',
    [string]$Remote = 'origin'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Dogger-Common.ps1')

$DoggerPorts = 8765..8774
$repoRoot = (Split-Path -Parent $PSScriptRoot).TrimEnd('\', '/')
$batPath = Join-Path $repoRoot 'Start-Dogger.bat'
$stateDir = Get-DoggerStateDir
$launcherLog = Join-Path $stateDir 'launcher.log'
$serveLog = Join-Path $stateDir 'serve.log'
$script:warned = $false

try { $Host.UI.RawUI.WindowTitle = 'Dogger launcher' } catch { }

function Complete-Launcher {
    param([int]$Code = 0, [switch]$Quick)
    if (-not $NoPause -and -not $Quick) {
        if ($Code -ne 0 -or $script:warned) {
            Write-Host ''
            Read-Host 'Press Enter to close this window' | Out-Null
        } else {
            Start-Sleep -Seconds 4
        }
    }
    exit $Code
}

function Write-Warning2 {
    param([string]$Message)
    $script:warned = $true
    Write-DoggerStatus -Kind warn -Message $Message
    Write-DoggerLogFile -Path $launcherLog -Message ("WARN " + $Message)
}

function Write-Problem {
    param([string]$Message)
    Write-DoggerStatus -Kind error -Message $Message
    Write-DoggerLogFile -Path $launcherLog -Message ("ERROR " + $Message)
}

Write-DoggerStatus -Kind step -Message 'Dogger launcher'
Write-DoggerStatus -Kind info -Message ("Folder: {0}" -f $repoRoot)
Write-DoggerLogFile -Path $launcherLog -Message ("Launcher started for {0}" -f $repoRoot)

# ---- -Stop ----
if ($Stop) {
    $stopped = 0
    foreach ($p in $DoggerPorts) {
        $status = Get-DoggerServerStatus -Port $p
        if ($status) {
            Stop-DoggerServer -Status $status
            Write-DoggerStatus -Kind ok -Message ("Stopped the Dogger server on port {0} (it was serving {1})." -f $p, $status.root)
            $stopped++
        }
    }
    if ($stopped -eq 0) { Write-DoggerStatus -Kind info -Message 'No Dogger server is running.' }
    Complete-Launcher -Quick
}

# ---- -CreateDesktopShortcut ----
if ($CreateDesktopShortcut) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop 'Dogger.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $batPath
    $shortcut.WorkingDirectory = $repoRoot
    $shortcut.Description = 'Start Dogger (latest development build)'
    $shortcut.Save()
    Write-DoggerStatus -Kind ok -Message ("Created desktop shortcut: {0}" -f $shortcutPath)
    Complete-Launcher -Quick
}

# ---- git must be present ----
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Problem 'Git is not installed or not on PATH. Install Git for Windows from https://git-scm.com/download/win and launch Dogger again.'
    Complete-Launcher -Code 1
}

# Remember where this repository lives, so a desktop copy of Start-Dogger.bat can find it.
Write-DoggerUtf8File -Path (Join-Path $stateDir 'repo-path.txt') -Text $repoRoot

# ---- 1-2. GitHub update check ----
if ($NoUpdate) {
    Write-DoggerStatus -Kind info -Message 'Skipping the GitHub check (-NoUpdate). Running the local copy as it is.'
} else {
    Write-DoggerStatus -Kind step -Message ("Checking GitHub for updates ({0}/{1})..." -f $Remote, $Branch)
    $sync = Sync-DoggerRepo -RepoPath $repoRoot -Remote $Remote -Branch $Branch -AllowSwitch
    Write-DoggerLogFile -Path $launcherLog -Message ("Sync result: {0} - {1}" -f $sync.Status, $sync.Message)

    switch ($sync.Status) {
        'current' {
            Write-DoggerStatus -Kind ok -Message ("Already up to date ({0})." -f $sync.Before)
            foreach ($line in $sync.Details) { Write-DoggerStatus -Kind info -Message $line }
        }
        'updated' {
            Write-DoggerStatus -Kind ok -Message ("Updated {0} -> {1}. {2}" -f $sync.Before, $sync.After, $sync.Message)
            foreach ($line in $sync.Details) { Write-DoggerStatus -Kind info -Message $line }
        }
        'ahead' {
            Write-DoggerStatus -Kind info -Message $sync.Message
        }
        'blocked-local-changes' {
            Write-Warning2 ("Update blocked by local changes. {0}" -f $sync.Message)
            foreach ($line in $sync.Details) { Write-DoggerStatus -Kind warn -Message $line }
            Write-DoggerStatus -Kind warn -Message 'Commit, stash, or move those files, then launch again to get the update. Running your local copy for now.'
        }
        'diverged' {
            Write-Problem ("Update stopped: the branches have diverged. {0}" -f $sync.Message)
            foreach ($line in $sync.Details) { Write-DoggerStatus -Kind info -Message $line }
            Write-DoggerStatus -Kind error -Message 'Nothing was deleted or reset. Push or merge your local commits, or ask for help resolving the difference, then launch again.'
            Complete-Launcher -Code 2
        }
        'not-git' {
            Write-Problem $sync.Message
            Complete-Launcher -Code 1
        }
        'offline' {
            Write-Warning2 ("{0} Running the local copy ({1})." -f $sync.Message, $sync.Before)
        }
        'other-branch' {
            Write-Warning2 ("{0} Switch this copy to '{1}' to receive Dogger updates." -f $sync.Message, $Branch)
        }
        'missing-branch' {
            Write-Warning2 ("{0} Running the local copy." -f $sync.Message)
        }
        'busy' {
            Write-Warning2 ("{0} Running the local copy." -f $sync.Message)
        }
        default {
            Write-Warning2 ("Update check did not finish ({0}). Running the local copy unchanged." -f $sync.Message)
            foreach ($line in $sync.Details) { Write-DoggerStatus -Kind warn -Message $line }
        }
    }
}

$localCommit = Write-DoggerVersionFile -RepoPath $repoRoot
if (-not $localCommit) {
    Write-Problem 'Could not read the checked-out commit. Is this folder a Git clone of Dogger?'
    Complete-Launcher -Code 1
}

# ---- 3. Local server: reuse, replace an old copy, or start a new one ----
Write-DoggerStatus -Kind step -Message 'Starting the local Dogger server...'
$candidatePorts = $DoggerPorts
if ($Port -gt 0) { $candidatePorts = @($Port) }

$serverPort = 0
$serverStatus = $null
foreach ($p in $candidatePorts) {
    $existing = Get-DoggerServerStatus -Port $p
    if ($existing) {
        if (Test-DoggerSamePath -A $existing.root -B $repoRoot) {
            $serverPort = $p
            $serverStatus = $existing
            Write-DoggerStatus -Kind ok -Message ("Reusing the Dogger server already running on port {0}." -f $p)
            break
        }
        Write-DoggerStatus -Kind info -Message ("Stopping an older Dogger server on port {0} that was serving {1}." -f $p, $existing.root)
        Stop-DoggerServer -Status $existing
        for ($wait = 0; $wait -lt 20 -and (Test-DoggerPortOpen -Port $p); $wait++) { Start-Sleep -Milliseconds 250 }
    }
    if (-not (Test-DoggerPortOpen -Port $p)) {
        $serverPort = $p
        break
    }
}

if ($serverPort -eq 0) {
    Write-Problem ("No free port for the Dogger server. Ports {0}-{1} are all in use by other programs." -f $candidatePorts[0], $candidatePorts[-1])
    Complete-Launcher -Code 1
}

if (-not $serverStatus) {
    $serveScript = Join-Path $PSScriptRoot 'Serve-Dogger.ps1'
    $powerShellExe = (Get-Process -Id $PID).Path
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Root "{1}" -Port {2} -Branch "{3}" -Remote "{4}"' -f $serveScript, $repoRoot, $serverPort, $Branch, $Remote
    # The server must not hold this window's output open, so its console streams go to files.
    $startArgs = @{
        FilePath               = $powerShellExe
        ArgumentList           = $arguments
        RedirectStandardOutput = (Join-Path $stateDir 'serve-host.out.txt')
        RedirectStandardError  = (Join-Path $stateDir 'serve-host.err.txt')
    }
    if ($env:OS -eq 'Windows_NT') { $startArgs.WindowStyle = 'Hidden' }
    Start-Process @startArgs | Out-Null
    $serverStatus = Wait-DoggerServer -Port $serverPort -Seconds 20
    if (-not $serverStatus) {
        Write-Problem ("The local server did not answer on port {0}." -f $serverPort)
        if (Test-Path -LiteralPath $serveLog) {
            Write-DoggerStatus -Kind info -Message 'Last lines of the server log:'
            Get-Content -LiteralPath $serveLog -Tail 6 | ForEach-Object { Write-DoggerStatus -Kind info -Message ("  " + $_) }
        }
        Write-DoggerStatus -Kind info -Message ("Full log: {0}" -f $serveLog)
        Complete-Launcher -Code 1
    }
    Write-DoggerStatus -Kind ok -Message ("Server is running on port {0}." -f $serverPort)
}

# ---- 3b. Verify the server is serving the commit we checked out ----
$url = 'http://localhost:{0}/' -f $serverPort
try {
    $served = Invoke-RestMethod -Uri ('{0}version.json' -f $url) -TimeoutSec 5 -UseBasicParsing
} catch {
    Write-Problem ("The server answers, but version.json could not be read: {0}" -f $_.Exception.Message)
    Complete-Launcher -Code 1
}
if ($served.commit -ne $localCommit) {
    Write-Warning2 ("The server is serving commit {0}, but this copy is at {1}. It will catch up within two minutes." -f (Get-DoggerShortSha $served.commit), (Get-DoggerShortSha $localCommit))
} else {
    Write-DoggerStatus -Kind ok -Message ("Serving build {0} at {1}" -f (Get-DoggerShortSha $localCommit), $url)
}

# ---- 4. Open the game ----
if ($NoBrowser) {
    Write-DoggerStatus -Kind info -Message ("Browser not opened (-NoBrowser). Open {0}" -f $url)
} else {
    $how = Open-DoggerBrowser -Url $url
    if ($how -eq 'chrome') {
        Write-DoggerStatus -Kind ok -Message 'Opened Dogger in Chrome.'
    } else {
        Write-Warning2 'Chrome was not found, so Dogger opened in your default browser.'
    }
}

Write-DoggerLogFile -Path $launcherLog -Message ("Launched {0} on port {1}" -f $localCommit, $serverPort)
Write-DoggerStatus -Kind ok -Message ("Dogger is running at {0}" -f $url)
Write-DoggerStatus -Kind info -Message 'The server keeps running in the background and picks up new GitHub updates on its own.'
Write-DoggerStatus -Kind info -Message 'To stop it, run Start-Dogger.bat -Stop from a command prompt.'
Complete-Launcher -Code 0
