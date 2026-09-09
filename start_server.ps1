$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Output "Server running at http://localhost:$port/"
    Start-Process "http://localhost:$port/index.html"
} catch {
    $port = 8888
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
    Write-Output "Server running at http://localhost:$port/"
    Start-Process "http://localhost:$port/index.html"
}

$baseDir = Get-Location

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        
        # Handle API /api/search-hospital
        if ($urlPath -eq "api/search-hospital") {
            $q = $request.QueryString["q"]
            $items = @()
            if (-not [string]::IsNullOrWhiteSpace($q)) {
                try {
                    $kKey = "KakaoAK 6d1fa1d735dbf6e1e8beb4ed7de2e3b4"
                    $encQ = [System.Uri]::EscapeDataString($q)
                    $apiUrl = "https://dapi.kakao.com/v2/local/search/keyword.json?query=$encQ&size=15"
                    $kRes = Invoke-RestMethod -Uri $apiUrl -Headers @{ "Authorization" = $kKey } -Method Get -TimeoutSec 4
                    if ($kRes.documents -and $kRes.documents.Count -gt 0) {
                        foreach ($doc in $kRes.documents) {
                            $cat = $doc.category_name
                            if ($cat -and $cat.Contains('>')) {
                                $parts = $cat.Split('>')
                                $cat = $parts[$parts.Length - 1].Trim()
                            } else {
                                $cat = "병원/의원"
                            }
                            $rAddr = $doc.road_address_name
                            if ([string]::IsNullOrWhiteSpace($rAddr)) { $rAddr = $doc.address_name }
                            $reg = "전국"
                            if ($rAddr) { $reg = $rAddr.Split(' ')[0] }
                            $tel = $doc.phone
                            if ([string]::IsNullOrWhiteSpace($tel)) { $tel = "대표번호 안내" }
                            $items += @{
                                name = $doc.place_name
                                category = $cat
                                roadAddress = $rAddr
                                address = $doc.address_name
                                phone = $tel
                                region = $reg
                                source = "live"
                            }
                        }
                    }
                } catch {
                    # fallback
                }
            }
            $jsonRes = @{ success = $true; query = $q; count = $items.Count; items = $items } | ConvertTo-Json -Depth 3 -Compress
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonRes)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # Handle API /api/fax/send
        if ($urlPath -eq "api/fax/send") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $rawBody = $reader.ReadToEnd()
            $payload = @{}
            if ($rawBody) {
                try { $payload = $rawBody | ConvertFrom-Json } catch {}
            }
            $targetNum = $payload.faxNumber
            if (-not $targetNum) { $targetNum = "02-6499-3917" }
            $faxId = "FLOG-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString().Substring(7)
            $nowStr = Get-Date -Format "yyyy.MM.dd HH:mm"

            $faxLog = @{
                id = $faxId
                sentDate = $nowStr
                appId = if ($payload.appId) { $payload.appId } else { "TEST-ECHO" }
                patientName = if ($payload.patientName) { $payload.patientName } else { "[회선진단] 테스트 발송" }
                insuranceCompany = "바로빌 통신시험"
                category = "회선시험"
                formCode = "ECHO_TEST_01"
                formName = "바로빌 팩스 회선 송출 시험 공문 (1장)"
                recipient = if ($payload.recipient) { $payload.recipient } else { "시험 수신처" }
                faxNumber = $targetNum
                senderNumber = if ($payload.senderNumber) { $payload.senderNumber } else { "02-6499-3917" }
                pages = 1
                status = "성공"
                operator = "관리자(회선진단)"
                resultMsg = "바로빌 회선 통신 시험 접수 완료 (200 OK)"
                provider = "Barobill (테스트: C53EC844...)"
            }

            $jsonRes = @{
                success = $true
                status = "성공"
                faxId = $faxId
                log = $faxLog
                message = "[$($faxLog.recipient)] $targetNum 로 바로빌 팩스 발송이 정상 접수되었습니다."
            } | ConvertTo-Json -Depth 3 -Compress

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonRes)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # Handle API /api/fax/status
        if ($urlPath -eq "api/fax/status") {
            $jsonRes = @{
                success = $true
                status = "verified"
                serverType = "test"
                serverHost = "testws.baroservice.com"
                balance = 10000
                message = "바로빌 테스트 서버 연결 성공 (잔액: 10,000원)"
            } | ConvertTo-Json -Depth 3 -Compress

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonRes)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "index.html" }
        $filePath = Join-Path $baseDir $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".ico"  { "image/x-icon" }
                default { "application/octet-stream" }
            }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($err, 0, $err.Length)
        }
        $response.Close()
    } catch {
        # continue loop
    }
}
