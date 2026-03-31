param(
    [string]$StackName = "CodingPlatformStack",
    [ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")]
    [string]$Method = "GET",
    [string]$ProxyPath = "languages",
    [string]$Query = "",
    [string]$Body = "",
    [switch]$ShowToken
)

$ErrorActionPreference = "Stop"

function Get-StackOutputValue {
    param(
        [string]$Stack,
        [string]$OutputKey
    )

    aws cloudformation describe-stacks `
        --stack-name $Stack `
        --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" `
        --output text
}

$apiUrl = (Get-StackOutputValue -Stack $StackName -OutputKey "ApiGatewayUrl").Trim().TrimEnd("/")
if (-not $apiUrl) {
    throw "ApiGatewayUrl output not found for stack '$StackName'."
}

$proxySecretArn = (Get-StackOutputValue -Stack $StackName -OutputKey "Judge0ProxyTokenSecretArn").Trim()
if (-not $proxySecretArn) {
    throw "Judge0ProxyTokenSecretArn output not found for stack '$StackName'."
}

$proxyToken = aws secretsmanager get-secret-value `
    --secret-id $proxySecretArn `
    --query SecretString `
    --output text |
    ConvertFrom-Json |
    Select-Object -ExpandProperty token

if (-not $proxyToken) {
    throw "Proxy token was empty in secret '$proxySecretArn'."
}

$cleanProxyPath = $ProxyPath.Trim().TrimStart("/")
if (-not $cleanProxyPath) {
    throw "ProxyPath cannot be empty."
}

$uri = "$apiUrl/proxy/judge0/$cleanProxyPath"
if ($Query) {
    $uri = "$uri?$Query"
}

$headers = @{ "X-Proxy-Token" = $proxyToken }

Write-Host "API URL:      $apiUrl"
Write-Host "Proxy route:  $uri"
Write-Host "HTTP method:  $Method"
if ($ShowToken) {
    Write-Host "Proxy token:  $proxyToken"
}

try {
    if ($Body) {
        $response = Invoke-WebRequest -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $Body
    }
    else {
        $response = Invoke-WebRequest -Method $Method -Uri $uri -Headers $headers
    }

    Write-Host "Status:       $($response.StatusCode)"
    if ($response.Content) {
        try {
            $parsed = $response.Content | ConvertFrom-Json
            $parsed | ConvertTo-Json -Depth 20
        }
        catch {
            $response.Content
        }
    }
}
catch {
    $statusCode = $null
    $errorBody = $null

    if ($_.Exception.Response) {
        try {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        catch {
            $statusCode = $null
        }

        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
        }
        catch {
            $errorBody = $null
        }
    }

    if ($statusCode) {
        Write-Host "Status:       $statusCode"
    }
    if ($errorBody) {
        Write-Host $errorBody
    }

    throw
}
