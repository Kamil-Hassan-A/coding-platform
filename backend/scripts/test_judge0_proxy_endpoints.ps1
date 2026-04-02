[CmdletBinding()]
param(
    [string]$StackName = "CodingPlatformStack",
    [string]$ApiUrl = "",
    [string]$ProxyToken = "",
    [int]$PollAttempts = 12,
    [int]$PollDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

function Get-StackOutputValue {
    param(
        [Parameter(Mandatory = $true)][string]$Stack,
        [Parameter(Mandatory = $true)][string]$OutputKey
    )

    aws cloudformation describe-stacks `
        --stack-name $Stack `
        --query "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue" `
        --output text
}

function Resolve-ApiUrl {
    if ($ApiUrl) {
        return $ApiUrl.Trim().TrimEnd("/")
    }

    $value = (Get-StackOutputValue -Stack $StackName -OutputKey "ApiGatewayUrl").Trim().TrimEnd("/")
    if (-not $value) {
        throw "ApiGatewayUrl output not found for stack '$StackName'."
    }
    return $value
}

function Resolve-ProxyToken {
    if ($ProxyToken) {
        return $ProxyToken.Trim()
    }

    $secretArn = (Get-StackOutputValue -Stack $StackName -OutputKey "Judge0ProxyTokenSecretArn").Trim()
    if (-not $secretArn) {
        throw "Judge0ProxyTokenSecretArn output not found for stack '$StackName'."
    }

    $tokenValue = aws secretsmanager get-secret-value `
        --secret-id $secretArn `
        --query SecretString `
        --output text |
        ConvertFrom-Json |
        Select-Object -ExpandProperty token

    if (-not $tokenValue) {
        throw "Proxy token was empty in secret '$secretArn'."
    }

    return $tokenValue
}

function Invoke-Endpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        [hashtable]$Headers,
        [object]$Body = $null
    )

    Write-Host "\n==> $Name"
    Write-Host "    $Method $Uri"

    try {
        if ($null -ne $Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 20 -Compress
            $response = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $jsonBody
        }
        else {
            $response = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
        }

        Write-Host "    PASS"
        return [PSCustomObject]@{
            Ok = $true
            Data = $response
        }
    }
    catch {
        Write-Host "    FAIL"
        Write-Host "    $($_.Exception.Message)"

        $errorBody = $null
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $errorBody = $_.ErrorDetails.Message
        }

        if (-not $errorBody -and $_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
            }
            catch {
                $errorBody = $null
            }
        }

        if ($errorBody) {
            Write-Host "    Response body: $errorBody"
        }

        return [PSCustomObject]@{
            Ok = $false
            Data = $null
            Error = $_.Exception.Message
        }
    }
}

$resolvedApiUrl = Resolve-ApiUrl
$resolvedToken = Resolve-ProxyToken

$proxyHeaders = @{ "X-Proxy-Token" = $resolvedToken }

Write-Host "API URL: $resolvedApiUrl"
Write-Host "Using stack: $StackName"

$results = @()

$results += [PSCustomObject]@{
    Name = "Backend Judge0 health"
    Result = Invoke-Endpoint -Name "Backend health" -Method "GET" -Uri "$resolvedApiUrl/health/judge0"
}

$results += [PSCustomObject]@{
    Name = "Backend Judge0 smoke"
    Result = Invoke-Endpoint -Name "Backend smoke" -Method "GET" -Uri "$resolvedApiUrl/health/judge0/smoke"
}

$results += [PSCustomObject]@{
    Name = "Proxy languages"
    Result = Invoke-Endpoint -Name "Proxy languages" -Method "GET" -Uri "$resolvedApiUrl/proxy/judge0/languages" -Headers $proxyHeaders
}

$results += [PSCustomObject]@{
    Name = "Proxy statuses"
    Result = Invoke-Endpoint -Name "Proxy statuses" -Method "GET" -Uri "$resolvedApiUrl/proxy/judge0/statuses" -Headers $proxyHeaders
}

$submissionPayload = @{
    source_code = "print('proxy-ok')"
    language_id = 71
    stdin = ""
    expected_output = "proxy-ok"
}

$submit = Invoke-Endpoint `
    -Name "Proxy submit (async)" `
    -Method "POST" `
    -Uri "$resolvedApiUrl/proxy/judge0/submissions?base64_encoded=false&wait=false" `
    -Headers $proxyHeaders `
    -Body $submissionPayload

$results += [PSCustomObject]@{
    Name = "Proxy submit"
    Result = $submit
}

if ($submit.Ok -and $submit.Data.token) {
    $token = [string]$submit.Data.token
    $token = $token.Trim()
    if (-not $token) {
        $results += [PSCustomObject]@{
            Name = "Proxy poll"
            Result = [PSCustomObject]@{
                Ok = $false
                Data = $null
                Error = "Submission token was empty"
            }
        }
    }
    else {
        $pollUri = "$resolvedApiUrl/proxy/judge0/submissions/${token}?base64_encoded=false"
    $terminalIds = @(3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)

        $finalPoll = $null
        for ($i = 1; $i -le $PollAttempts; $i++) {
            $poll = Invoke-Endpoint -Name "Poll submission attempt $i" -Method "GET" -Uri $pollUri -Headers $proxyHeaders
            if (-not $poll.Ok) {
                $finalPoll = $poll
                break
            }

            $statusId = $null
            try {
                $statusId = [int]$poll.Data.status.id
            }
            catch {
                $statusId = $null
            }

            $finalPoll = $poll
            if ($statusId -in $terminalIds) {
                break
            }

            Start-Sleep -Seconds $PollDelaySeconds
        }

        $results += [PSCustomObject]@{
            Name = "Proxy poll"
            Result = $finalPoll
        }
    }
}

Write-Host "\n=== Summary ==="
$failed = @()
foreach ($item in $results) {
    $ok = [bool]$item.Result.Ok
    $label = if ($ok) { "PASS" } else { "FAIL" }
    Write-Host "[$label] $($item.Name)"
    if (-not $ok) {
        $failed += $item
    }
}

if ($failed.Count -gt 0) {
    Write-Host "\nOne or more endpoint checks failed."
    exit 1
}

Write-Host "\nAll proxy endpoint checks passed."