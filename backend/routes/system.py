import time

import requests
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from judge0_service import Judge0Service

router = APIRouter(tags=["system"])

judge0_service = Judge0Service()


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
            language="python",
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