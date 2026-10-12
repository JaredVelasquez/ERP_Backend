$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data

function Hide([string]$text) {
  if ([string]::IsNullOrEmpty($env:DB_PASSWORD)) { return $text }
  return $text.Replace($env:DB_PASSWORD, '(redacted)')
}

function Write-Message($payload) {
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $payload -Compress -Depth 6))
}

$cs = "Server=$($env:DB_HOST);Database=$($env:DB_NAME);User ID=$($env:DB_USER);Password=$($env:DB_PASSWORD);Encrypt=False;TrustServerCertificate=True;"
$connection = New-Object System.Data.SqlClient.SqlConnection $cs
try {
  $connection.Open()
} catch {
  Write-Message @{ ready = $false; error = (Hide $_.Exception.Message) }
  exit 1
}

Write-Message @{ ready = $true }
$transaction = $null

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq '') { continue }
  $command = $line | ConvertFrom-Json
  try {
    if ($command.op -eq 'begin') {
      $transaction = $connection.BeginTransaction()
      Write-Message @{ id = $command.id; rows = @() }
      continue
    }
    if ($command.op -eq 'commit') {
      $transaction.Commit()
      $transaction = $null
      Write-Message @{ id = $command.id; rows = @() }
      continue
    }
    if ($command.op -eq 'rollback') {
      if ($null -ne $transaction) { $transaction.Rollback() }
      $transaction = $null
      Write-Message @{ id = $command.id; rows = @() }
      continue
    }
    $sqlCmd = $connection.CreateCommand()
    $sqlCmd.CommandText = $command.sql
    $sqlCmd.CommandTimeout = 60
    if ($null -ne $transaction) { $sqlCmd.Transaction = $transaction }
    if ($null -ne $command.params) {
      foreach ($prop in $command.params.PSObject.Properties) {
        $value = $prop.Value
        if ($null -eq $value) { $value = [DBNull]::Value }
        $null = $sqlCmd.Parameters.AddWithValue("@$($prop.Name)", $value)
      }
    }
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter $sqlCmd
    $table = New-Object System.Data.DataTable
    [void]$adapter.Fill($table)
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($row in $table.Rows) {
      $item = [ordered]@{}
      foreach ($column in $table.Columns) {
        $cell = $row[$column]
        if ($cell -is [DBNull]) { $item[$column.ColumnName] = $null }
        else { $item[$column.ColumnName] = [string]$cell }
      }
      $rows.Add($item)
    }
    Write-Message @{ id = $command.id; rows = $rows }
  } catch {
    Write-Message @{ id = $command.id; error = (Hide $_.Exception.Message) }
  }
}
