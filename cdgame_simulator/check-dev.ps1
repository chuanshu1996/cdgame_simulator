$api = Invoke-WebRequest -Uri "http://localhost:8080/api/hero-data" -Headers @{Authorization='Bearer 4f323fde03b2d593d6988bb02ab0b7b7'} -UseBasicParsing -ErrorAction SilentlyContinue
if ($api) {
    try { $j = $api.Content | ConvertFrom-Json; Write-Host "API_VIA_PROXY_STATUS=$($api.StatusCode) count=$($j.Length)" }
    catch { Write-Host "API_VIA_PROXY_PARSE_FAIL: $($api.Content.Substring(0,200))" }
} else {
    Write-Host "API_VIA_PROXY_FAILED"
}
