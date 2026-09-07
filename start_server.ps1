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
