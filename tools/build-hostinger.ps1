param([string]$Destination = 'champion-site-hostinger-20260917-refinamentos.zip')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$siteRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../frontend'))
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$zipTarget = [IO.Path]::GetFullPath((Join-Path $repoRoot $Destination))
if (Test-Path -LiteralPath $zipTarget) { throw "Arquivo já existe; escolha outro destino: $zipTarget" }
$files = @(Get-ChildItem -LiteralPath $siteRoot -Recurse -File -Force)
if ($files.Name -match '^\.env(?:\.|$)|\.pem$|service-account\.json$') { throw 'Possível segredo na pasta frontend; pacote não criado.' }
$stream = [IO.File]::Open($zipTarget, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite)
$archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($siteRoot.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose(); $stream.Dispose() }
$reader = [IO.Compression.ZipFile]::OpenRead($zipTarget)
$sha = [Security.Cryptography.SHA256]::Create()
try {
  if ($reader.Entries.Count -ne $files.Count) { throw 'Quantidade de arquivos divergente.' }
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($siteRoot.Length + 1).Replace('\', '/')
    $entry = $reader.GetEntry($relative)
    if (!$entry -or $entry.FullName.Contains('\') -or $entry.FullName.StartsWith('frontend/')) { throw "Caminho inválido: $relative" }
    $entryStream = $entry.Open()
    $sourceStream = [IO.File]::OpenRead($file.FullName)
    try {
      $packedHash = [BitConverter]::ToString($sha.ComputeHash($entryStream))
      $sourceHash = [BitConverter]::ToString($sha.ComputeHash($sourceStream))
      if ($packedHash -ne $sourceHash) { throw "Conteúdo divergente: $relative" }
    } finally { $entryStream.Dispose(); $sourceStream.Dispose() }
  }
  if (!$reader.GetEntry('.htaccess') -or !$reader.GetEntry('index.html') -or !$reader.GetEntry('js/chat-widget.js')) { throw 'Pacote incompleto.' }
} finally { $sha.Dispose(); $reader.Dispose() }
[pscustomobject]@{ arquivo=$zipTarget; arquivos=$files.Count; tamanhoMB=[Math]::Round((Get-Item -LiteralPath $zipTarget).Length / 1MB, 2); hashes='todos verificados'; estrutura='arquivos na raiz, caminhos com /' } | ConvertTo-Json
