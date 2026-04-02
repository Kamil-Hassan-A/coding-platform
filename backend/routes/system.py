import hmac
import os
import time

import requests
from fastapi import APIRouter, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from judge0_service import Judge0Service

router = APIRouter(tags=["system"])

judge0_service = Judge0Service()

_HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}
_PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


def _get_proxy_token() -> str:
    return os.getenv("JUDGE0_PROXY_TOKEN", "").strip()


def _get_allowed_proxy_prefixes() -> tuple[str, ...]:
    return (
        "submissions",
        "languages",
        "statuses",
        "config_info",
        "system_info",
    )


def _require_proxy_token(x_proxy_token: str | None, x_api_key: str | None) -> None:
    expected = _get_proxy_token()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Judge0 proxy token is not configured",
        )

    provided = (x_proxy_token or x_api_key or "").strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid proxy token",
        )


def _validate_proxy_path(proxy_path: str) -> str:
    cleaned = proxy_path.strip().lstrip("/")
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Proxy path is required")
    if ".." in cleaned or cleaned.startswith("http://") or cleaned.startswith("https://"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid proxy path")

    allowed = _get_allowed_proxy_prefixes()
    if not any(cleaned == prefix or cleaned.startswith(f"{prefix}/") for prefix in allowed):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Path is not allowed by proxy policy",
                "allowed_prefixes": list(allowed),
            },
        )

    return cleaned


def _build_proxy_headers(incoming_headers: dict[str, str]) -> dict[str, str]:
    outbound = judge0_service._headers()
    for key, value in incoming_headers.items():
        lower = key.lower()
        if lower in _HOP_BY_HOP_HEADERS:
            continue
        if lower in {"authorization", "x-auth-token", "x-proxy-token", "x-api-key"}:
            continue
        if lower in {"content-type", "accept"}:
            outbound[key] = value
    return outbound


def _judge0_get(path: str, timeout_seconds: int | None = None) -> requests.Response:
    url = f"{judge0_service.base_url}{path}"
    response = requests.get(
        url,
        headers=judge0_service._headers(),
        timeout=timeout_seconds or min(10, judge0_service.timeout_seconds),
    )
    response.raise_for_status()
    return response


@router.get("/health/judge0")
def judge0_health() -> JSONResponse:
    """Lightweight Judge0 reachability check using the /languages endpoint."""
    url = f"{judge0_service.base_url}/languages"
    started = time.perf_counter()
    try:
        response = requests.get(
            url,
            headers=judge0_service._headers(),
            timeout=min(10, judge0_service.timeout_seconds),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "down",
                "judge0_reachable": False,
                "judge0_base_url": judge0_service.base_url,
                "error": str(exc),
            },
        )

    latency_ms = int((time.perf_counter() - started) * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "judge0_reachable": True,
            "judge0_base_url": judge0_service.base_url,
            "latency_ms": latency_ms,
        },
    )


@router.get("/health/judge0/smoke")
def judge0_smoke_test() -> JSONResponse:
    """End-to-end Judge0 execution check with a tiny Python submission."""
    started = time.perf_counter()
    try:
        result = judge0_service.execute(
            code='print("ok")',
            language_id=71,
            test_inputs=[{"input": "", "expected_output": "ok"}],
        )
    except (requests.RequestException, TimeoutError, RuntimeError, ValueError) as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "down",
                "judge0_execution": False,
                "judge0_base_url": judge0_service.base_url,
                "error": str(exc),
            },
        )

    latency_ms = int((time.perf_counter() - started) * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "judge0_execution": bool(result.get("passed", False)),
            "judge0_base_url": judge0_service.base_url,
            "latency_ms": latency_ms,
            "passed_tests": int(result.get("passed_tests", 0)),
            "total_tests": int(result.get("total_tests", 0)),
        },
    )


@router.get("/judge0/languages")
@router.get("/judge0/language")
def judge0_languages() -> JSONResponse:
    """Proxy Judge0 languages list so backend can verify language availability."""
    started = time.perf_counter()
    try:
        response = _judge0_get("/languages")
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "down",
                "judge0_base_url": judge0_service.base_url,
                "error": str(exc),
            },
        )

    languages = payload if isinstance(payload, list) else []
    latency_ms = int((time.perf_counter() - started) * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "judge0_base_url": judge0_service.base_url,
            "latency_ms": latency_ms,
            "count": len(languages),
            "languages": languages,
        },
    )


@router.get("/judge0/docs")
def judge0_docs() -> JSONResponse:
    """Expose Judge0 docs URL and probe a few useful API endpoints."""
    started = time.perf_counter()
    docs_url = f"{judge0_service.base_url}/docs"
    openapi_url = f"{judge0_service.base_url}/openapi.json"

    endpoint_candidates = [
        "/languages",
        "/statuses",
        "/submissions",
        "/config_info",
        "/system_info",
    ]

    available_endpoints: list[str] = []
    for endpoint in endpoint_candidates:
        try:
            _judge0_get(endpoint, timeout_seconds=5)
            available_endpoints.append(endpoint)
        except requests.RequestException:
            continue

    docs_reachable = False
    openapi_reachable = False
    try:
        _judge0_get("/docs", timeout_seconds=5)
        docs_reachable = True
    except requests.RequestException:
        docs_reachable = False

    try:
        _judge0_get("/openapi.json", timeout_seconds=5)
        openapi_reachable = True
    except requests.RequestException:
        openapi_reachable = False

    latency_ms = int((time.perf_counter() - started) * 1000)
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok" if docs_reachable or openapi_reachable else "partial",
            "judge0_base_url": judge0_service.base_url,
            "latency_ms": latency_ms,
            "docs_url": docs_url,
            "openapi_url": openapi_url,
            "docs_reachable": docs_reachable,
            "openapi_reachable": openapi_reachable,
            "available_endpoints": available_endpoints,
            "common_useful_endpoints": endpoint_candidates,
        },
    )


@router.api_route("/proxy/judge0/{proxy_path:path}", methods=_PROXY_METHODS)
async def judge0_proxy(
    proxy_path: str,
    request: Request,
    x_proxy_token: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> Response:
    """Shared-secret protected proxy from this API to internal Judge0."""
    _require_proxy_token(x_proxy_token=x_proxy_token, x_api_key=x_api_key)
    cleaned_path = _validate_proxy_path(proxy_path)

    raw_body = await request.body()
    params = list(request.query_params.multi_items())
    outgoing_headers = _build_proxy_headers(dict(request.headers.items()))
    upstream_url = f"{judge0_service.base_url}/{cleaned_path}"

    try:
        upstream = requests.request(
            method=request.method,
            url=upstream_url,
            params=params,
            data=raw_body if raw_body else None,
            headers=outgoing_headers,
            timeout=judge0_service.timeout_seconds,
            allow_redirects=False,
        )
    except requests.Timeout:
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={
                "error": "Judge0 request timed out",
                "judge0_base_url": judge0_service.base_url,
            },
        )
    except requests.RequestException as exc:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "error": "Failed to reach Judge0",
                "judge0_base_url": judge0_service.base_url,
                "detail": str(exc),
            },
        )

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in _HOP_BY_HOP_HEADERS
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )