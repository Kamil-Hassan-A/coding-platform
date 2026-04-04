import os
import time
import logging
from typing import Any

import requests


logger = logging.getLogger(__name__)


def _truncate_text(value: Any, limit: int = 2000) -> str:
    text = "" if value is None else str(value)
    if len(text) <= limit:
        return text
    return f"{text[:limit]}...<truncated:{len(text) - limit}>"


def _compact_judge0_result(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "token": result.get("token"),
        "status": result.get("status"),
        "stdout": _truncate_text(result.get("stdout")),
        "stderr": _truncate_text(result.get("stderr")),
        "compile_output": _truncate_text(result.get("compile_output")),
        "message": _truncate_text(result.get("message")),
        "time": result.get("time"),
        "memory": result.get("memory"),
    }


def map_status(result: dict[str, Any]) -> tuple[str, str | None]:
    compile_output = result.get("compile_output")
    if compile_output:
        return ("compile_error", _truncate_text(compile_output))

    stderr = result.get("stderr")
    if stderr:
        return ("runtime_error", _truncate_text(stderr))

    status_obj = result.get("status")
    status_id = status_obj.get("id") if isinstance(status_obj, dict) else None
    if status_id == 5:
        return ("time_limit_exceeded", _truncate_text(result.get("message")))
    if status_id == 3:
        return ("success", None)

    return ("runtime_error", _truncate_text(result.get("message")))


class Judge0Service:
    """Simple Judge0 CE client for code execution against multiple test inputs."""

    TERMINAL_STATUSES = {3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14}

    def __init__(self, base_url: str | None = None, timeout_seconds: int = 25) -> None:
        self.base_url = (base_url or os.getenv("JUDGE0_BASE_URL", "https://ce.judge0.com")).rstrip("/")
        self.timeout_seconds = timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {"Content-Type": "application/json"}

    def _post_submission(self, payload: dict[str, Any], wait: bool) -> dict[str, Any]:
        wait_flag = "true" if wait else "false"
        url = f"{self.base_url}/submissions?base64_encoded=false&wait={wait_flag}"
        response = requests.post(
            url,
            json=payload,
            headers=self._headers(),
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        return response.json()

    def _get_submission(self, token: str) -> dict[str, Any]:
        url = f"{self.base_url}/submissions/{token}?base64_encoded=false"
        response = requests.get(
            url,
            headers=self._headers(),
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        return response.json()

    def _execute_one(self, code: str, language_id: int, stdin: str, expected_output: str | None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "source_code": code,
            "language_id": language_id,
            "stdin": stdin,
        }
        if expected_output is not None:
            payload["expected_output"] = expected_output

        try:
            result = self._post_submission(payload, wait=True)
        except requests.HTTPError as exc:
            response = exc.response
            error_text = response.text.lower() if response is not None else ""
            if response is not None and response.status_code == 400 and "wait" in error_text:
                token_response = self._post_submission(payload, wait=False)
                token = token_response.get("token")
                if not token:
                    raise RuntimeError("Judge0 did not return a token for async submission") from exc

                last_result: dict[str, Any] = {"token": token}
                for _ in range(20):
                    polled = self._get_submission(token)
                    status_id = (polled.get("status") or {}).get("id")
                    last_result = polled
                    if status_id in self.TERMINAL_STATUSES:
                        return polled
                    time.sleep(0.5)
                raise TimeoutError("Timed out waiting for Judge0 submission result")
            raise
        logger.info("Judge0 case execution result: %s", _compact_judge0_result(result))
        return result

    def execute(self, code: str, language_id: int, test_inputs: list[Any]) -> dict[str, Any]:
        if not isinstance(language_id, int) or language_id <= 0:
            raise ValueError(f"Invalid Judge0 language id: {language_id}")

        logger.info(
            "Judge0 execute request: language_id=%s code=%s test_count=%s",
            language_id,
            _truncate_text(code),
            len(test_inputs or []),
        )

        normalized_cases = test_inputs if test_inputs else [{"input": "", "output": ""}]
        case_results: list[dict[str, Any]] = []

        for case in normalized_cases:
            if isinstance(case, dict):
                stdin = str(case.get("input", ""))
                expected_output = str(case.get("output", ""))
            else:
                stdin = str(case)
                expected_output = None

            result = self._execute_one(
                code=code,
                language_id=language_id,
                stdin=stdin,
                expected_output=expected_output,
            )
            logger.info("Judge0 raw response payload: %s", _compact_judge0_result(result))
            normalized_status, normalized_error = map_status(result)
            logger.info("Judge0 normalized case status: %s", normalized_status)
            status_obj = result.get("status")
            status = status_obj if isinstance(status_obj, dict) else {"id": 0, "description": "Unknown"}
            status_id = status.get("id")
            stdout_value = result.get("stdout")
            stderr_value = result.get("stderr")
            if expected_output is None:
                passed = status_id == 3
            else:
                passed = (status_id == 3) and ((stdout_value or "").strip() == expected_output.strip())

            case_results.append(
                {
                    "token": result.get("token"),
                    "stdin": stdin,
                    "expected_output": expected_output,
                    "stdout": stdout_value,
                    "stderr": stderr_value,
                    "compile_output": result.get("compile_output"),
                    "message": result.get("message"),
                    "status": status,
                    "time": result.get("time"),
                    "memory": result.get("memory"),
                    "normalized_status": normalized_status,
                    "normalized_error": normalized_error,
                    "passed": passed,
                }
            )

        passed_count = sum(1 for item in case_results if item["passed"])
        total_tests = len(case_results)
        overall_passed = passed_count == total_tests
        score = int((passed_count / total_tests) * 100) if total_tests > 0 else 0

        total_millis = 0
        for item in case_results:
            try:
                seconds = float(item.get("time") or 0)
            except (TypeError, ValueError):
                seconds = 0
            total_millis += int(seconds * 1000)

        final_response = {
            "passed": overall_passed,
            "passed_tests": passed_count,
            "total_tests": total_tests,
            "score": score,
            "time_taken": total_millis,
            "cases": case_results,
        }
        logger.info(
            "Judge0 aggregated result: passed_tests=%s total_tests=%s score=%s time_taken_ms=%s",
            final_response["passed_tests"],
            final_response["total_tests"],
            final_response["score"],
            final_response["time_taken"],
        )
        return final_response
