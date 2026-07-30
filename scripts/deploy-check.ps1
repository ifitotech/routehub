Set-Location $PSScriptRoot/..
Write-Host 'Installing dependencies...'
npm.cmd install
Write-Host 'Running typecheck...'
npm.cmd run typecheck
Write-Host 'Running production build...'
npm.cmd run build
Write-Host 'Ready to commit and deploy.'
