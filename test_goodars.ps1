Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = New-Object System.Net.CookieContainer
$client = New-Object System.Net.Http.HttpClient($handler)

# 1. Login
$loginUrl = "https://crm.goodars.co.kr/indexApp.asp?cp=hidea"
$content = New-Object System.Net.Http.FormUrlEncodedContent(([System.Collections.Generic.KeyValuePair[string,string]][]@(
    [System.Collections.Generic.KeyValuePair[string,string]]::new("m_id", "jga2413"),
    [System.Collections.Generic.KeyValuePair[string,string]]::new("m_pass", "jga2413#")
)))
$res = $client.PostAsync($loginUrl, $content).Result
Write-Output "Login status: $($res.StatusCode)"

# 2. Try fetching C_OutCall.asp
$outRes = $client.GetAsync("https://crm.goodars.co.kr/C_OutCall.asp").Result
$outBytes = $outRes.Content.ReadAsByteArrayAsync().Result
$outText = [System.Text.Encoding]::GetEncoding("euc-kr").GetString($outBytes)
Write-Output "--- C_OutCall.asp ---"
$outText.Substring(0, [Math]::Min(800, $outText.Length))

# 3. Try fetching admin/C_Calllog.asp or Call log
$callRes = $client.GetAsync("https://crm.goodars.co.kr/admin/C_Calllog.asp").Result
$callBytes = $callRes.Content.ReadAsByteArrayAsync().Result
$callText = [System.Text.Encoding]::GetEncoding("euc-kr").GetString($callBytes)
Write-Output "--- admin/C_Calllog.asp ---"
$callText.Substring(0, [Math]::Min(800, $callText.Length))
