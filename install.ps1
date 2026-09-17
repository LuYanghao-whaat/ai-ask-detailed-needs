#Requires -Version 5.1
<#
  Installer for the ai-ask-detailed-needs opencode skill.

  Copies:
    <repo>/                      -> <opencode config>/skills/ai-ask-detailed-needs/
    <repo>/tools/*.ts            -> <opencode config>/tools/

  Usage:
    .\install.ps1
    .\install.ps1 -Uninstall
    .\install.ps1 -Project .        # install into ./.opencode instead of the global config
#>
[CmdletBinding()]
param(
  [switch]$Uninstall,
  [string]$Project
)

$ErrorActionPreference = "Stop"

$SkillName = "ai-ask-detailed-needs"
$RepoRoot = $PSScriptRoot

function Resolve-ConfigRoot {
  param([string]$ProjectDir)
  if ($ProjectDir) {
    if (-not (Test-Path -LiteralPath $ProjectDir)) {
      throw "Project directory not found: $ProjectDir"
    }
    return (Join-Path (Resolve-Path -LiteralPath $ProjectDir).Path ".opencode")
  }
  if ($env:XDG_CONFIG_HOME) {
    return (Join-Path $env:XDG_CONFIG_HOME "opencode")
  }
  $home_ = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
  if (-not $home_) { throw "Cannot determine the home directory." }
  return (Join-Path $home_ ".config\opencode")
}

$ConfigRoot = Resolve-ConfigRoot -ProjectDir $Project
$SkillTarget = Join-Path $ConfigRoot "skills\$SkillName"
$ToolTarget = Join-Path $ConfigRoot "tools\$SkillName.ts"
$ToolSource = Join-Path $RepoRoot "tools\$SkillName.ts"

if ($Uninstall) {
  $removed = @()
  if (Test-Path -LiteralPath $ToolTarget) {
    Remove-Item -LiteralPath $ToolTarget -Force
    $removed += $ToolTarget
  }
  if (Test-Path -LiteralPath $SkillTarget) {
    Remove-Item -LiteralPath $SkillTarget -Recurse -Force
    $removed += $SkillTarget
  }
  if ($removed.Count -eq 0) {
    Write-Host "Nothing to remove."
  } else {
    Write-Host "Removed:"
    $removed | ForEach-Object { Write-Host "  $_" }
  }
  Write-Host ""
  Write-Host "Restart opencode to apply."
  exit 0
}

if (-not (Test-Path -LiteralPath $ToolSource)) {
  throw "Missing $ToolSource - run this script from inside the repository."
}

Write-Host "opencode config : $ConfigRoot"
Write-Host ""

# 1. skill folder
$same = $false
try {
  $same = (Resolve-Path -LiteralPath $RepoRoot).Path -eq (Resolve-Path -LiteralPath $SkillTarget -ErrorAction SilentlyContinue).Path
} catch { $same = $false }

if ($same) {
  Write-Host "[=] skill already in place: $SkillTarget"
} else {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SkillTarget) | Out-Null
  if (Test-Path -LiteralPath $SkillTarget) {
    Remove-Item -LiteralPath $SkillTarget -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $SkillTarget | Out-Null
  foreach ($item in @("SKILL.md", "VERSION", "assets", "references", "README.md", "LICENSE")) {
    $src = Join-Path $RepoRoot $item
    if (Test-Path -LiteralPath $src) {
      Copy-Item -LiteralPath $src -Destination $SkillTarget -Recurse -Force
    }
  }
  Write-Host "[+] skill installed: $SkillTarget"
}

# 2. tool file
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ToolTarget) | Out-Null
Copy-Item -LiteralPath $ToolSource -Destination $ToolTarget -Force
Write-Host "[+] tool installed : $ToolTarget"

Write-Host ""
Write-Host "Done. Restart opencode so it picks up the skill and the tool."
