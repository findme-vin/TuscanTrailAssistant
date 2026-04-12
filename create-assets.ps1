$dir = "$PSScriptRoot\assets\images"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$png = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk" + "YPj/HwADBgEB/SQmIQAAAABJRU5ErkJggg==")
foreach ($name in @("icon.png","splash.png","adaptive-icon.png","favicon.png")) {
  [System.IO.File]::WriteAllBytes("$dir\$name", $png)
  Write-Host "Created $dir\$name"
}
