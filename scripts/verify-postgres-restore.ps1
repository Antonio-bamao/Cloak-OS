param(
  [Parameter(Mandatory = $true)]
  [string]$BackupPath,
  [string]$ContainerName = "cloak-restore-drill",
  [int]$HostPort = 55433,
  [string]$PostgresImage = "postgres:16-alpine",
  [string]$PostgresUser = "cloak",
  [string]$PostgresDb = "cloak",
  [string]$PostgresPassword = "cloak_restore_drill_password",
  [string]$AdminToken = "restore-drill-admin-token"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupPath)) {
  throw "Backup file not found: $BackupPath"
}

$databaseUrl = "postgres://${PostgresUser}:${PostgresPassword}@127.0.0.1:${HostPort}/${PostgresDb}"
$containerStarted = $false

try {
  & docker run -d --rm `
    --name $ContainerName `
    -e "POSTGRES_DB=$PostgresDb" `
    -e "POSTGRES_USER=$PostgresUser" `
    -e "POSTGRES_PASSWORD=$PostgresPassword" `
    -p "${HostPort}:5432" `
    $PostgresImage | Out-Null
  $containerStarted = $true

  for ($attempt = 1; $attempt -le 30; $attempt += 1) {
    & docker exec $ContainerName pg_isready -U $PostgresUser -d $PostgresDb | Out-Null
    if ($LASTEXITCODE -eq 0) {
      break
    }

    if ($attempt -eq 30) {
      throw "Restore drill PostgreSQL container did not become ready."
    }

    Start-Sleep -Seconds 1
  }

  Get-Content -LiteralPath $BackupPath -Raw |
    & docker exec -i $ContainerName psql -U $PostgresUser -d $PostgresDb

  & node src/database/run-migrations.js --status --database-url $databaseUrl
  & node src/database/run-postgres-smoke-check.js --database-url $databaseUrl
  & node src/database/run-postgres-api-smoke-check.js --database-url $databaseUrl --admin-token $AdminToken --check-health
  & node src/database/run-postgres-admin-smoke-check.js --database-url $databaseUrl --admin-token $AdminToken --check-health

  Write-Output "Restore drill passed against: $databaseUrl"
} finally {
  if ($containerStarted) {
    & docker stop $ContainerName | Out-Null
  }
}
