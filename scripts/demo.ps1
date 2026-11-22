param(
    [ValidateSet('Start','Frontend','Status','Date','Verify','Stop')][string]$Action='Status',
    [string]$Date,
    [string]$Database='boarding_house_e2e_test',
    [int]$MySqlPort=3317
)
$ErrorActionPreference='Stop'
function Test-DemoPort([int]$Port) {
    $client=New-Object Net.Sockets.TcpClient
    try {$task=$client.ConnectAsync('127.0.0.1',$Port);return ($task.Wait(500) -and $client.Connected)} catch {return $false} finally {$client.Dispose()}
}
$repoPath=Split-Path $PSScriptRoot -Parent
$demoPath=Join-Path $PSScriptRoot '.demo-local'
if ($Database -notmatch '^boarding_house_e2e_test(?:_[a-z0-9_]{1,35})?$') { throw 'Only dedicated demo schema names are accepted.' }
if ($MySqlPort -eq 3306) { throw 'Application database port 3306 is prohibited.' }
$demoPath=Join-Path $demoPath $Database
New-Item -ItemType Directory -Force -Path $demoPath | Out-Null
switch ($Action) {
 'Status' {
    [pscustomobject]@{apiAvailable=(Test-DemoPort 18083);frontendAvailable=(Test-DemoPort 13000);smtpInboxAvailable=(Test-DemoPort 18025)}
    foreach ($name in @('ready','clock.txt','clock-status.txt','manifest.json')) { $file=Join-Path $demoPath $name; if(Test-Path -LiteralPath $file){Get-Content -LiteralPath $file} }
    Write-Output "Private credentials: $demoPath/credentials.json"
 }
 'Date' {
    if($Date -notmatch '^202[67]-\d{2}-\d{2}$'){throw 'Use YYYY-MM-DD.'}
    $day=[datetime]::ParseExact($Date,'yyyy-MM-dd',$null)
    if($day -lt [datetime]'2026-10-01' -or $day -gt [datetime]'2027-12-31'){throw 'Demo date outside allowed range.'}
    [IO.File]::WriteAllText((Join-Path $demoPath 'clock.txt'),$Date)
    Write-Output 'Clock change requested. Read clock-status.txt for acknowledgment.'
 }
 'Stop' { [IO.File]::WriteAllText((Join-Path $demoPath 'stop'),'stop') }
 'Verify' { [IO.File]::WriteAllText((Join-Path $demoPath 'verify'),'verify') }
 'Frontend' {
    $env:NEXT_AUDIT_DIST_DIR='.next-audit14-demo';$env:NEXT_PUBLIC_API_BASE_URL='http://127.0.0.1:18083/api';$env:NODE_OPTIONS='--max-old-space-size=1536'
    Push-Location (Join-Path $repoPath 'boarding-house-frontend')
    try { & npm.cmd run dev -- --hostname 127.0.0.1 --port 13000 --webpack } finally {Pop-Location}
 }
 'Start' {
    if(Test-DemoPort 18083){throw 'Demo API port 18083 is in use. Check Status before starting another process.'}
    $credentialFile=Join-Path $demoPath 'credentials.json'
    if(-not(Test-Path -LiteralPath $credentialFile)){
       $bytes=New-Object byte[] 32;$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
       $credentials=@{password=('Test!'+[Convert]::ToBase64String($bytes));jwtSecret=[Convert]::ToBase64String($bytes)}
       [IO.File]::WriteAllText($credentialFile,($credentials | ConvertTo-Json))
    }
    $credentials=Get-Content -Raw -LiteralPath $credentialFile | ConvertFrom-Json
    $env:DEMO_CONFIRM='LOCAL_TEST_ONLY';$env:DEMO_DIRECTORY=$demoPath;$env:DEMO_PASSWORD=$credentials.password;$env:DEMO_JWT_SECRET=$credentials.jwtSecret
    $env:DEMO_DB_NAME=$Database;$env:DEMO_MYSQL_PORT="$MySqlPort"
    Push-Location (Join-Path $repoPath 'boarding-house-backend')
    try {
       & .\mvnw.cmd -q test-compile dependency:build-classpath '-DincludeScope=test' '-Dmdep.outputFile=target/demo-classpath.txt' '-DskipTests'
       if($LASTEXITCODE -ne 0){throw 'Demo compilation failed.'}
       $dependencies=(Get-Content target/demo-classpath.txt -Raw).Trim()
       & java '-Xmx768m' '-cp' "target/test-classes;target/classes;$dependencies" 'com.thangit.boardinghouse.service.DemoRuntime'
       if($LASTEXITCODE -ne 0){throw 'Demo runtime failed. The schema is retained for investigation.'}
    } finally {Pop-Location;Remove-Item Env:DEMO_PASSWORD,Env:DEMO_JWT_SECRET -ErrorAction SilentlyContinue}
 }
}
