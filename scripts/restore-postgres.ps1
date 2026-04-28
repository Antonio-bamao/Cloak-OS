param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$EnvFile = ".env.production",
  [string]$PostgresUser = "cloak",
  [string]$PostgresDb = "cloak"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupPath)) {
  throw "Backup file not found: $BackupPath"
}

if ($env:CLOAK_CONFIRM_RESTORE -ne "yes") {
  throw "Set CLOAK_CONFIRM_RESTORE=yes before running restore-postgres.ps1"
}

Get-Content -LiteralPath $BackupPath -Raw |
  & docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres psql -U $PostgresUser -d $PostgresDb

Write-Output "Restore completed from: $BackupPath"
