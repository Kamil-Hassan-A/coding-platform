import os
import time
from typing import Any

import requests


class Judge0Service:
    """Simple Judge0 CE client for code execution against multiple test inputs."""

    TERMINAL_STATUSES = {3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14}
    DEFAULT_LANGUAGE_MAP = {
        "python": 71,
        "python3": 71,
        "javascript": 63,
        "js": 63,
        "typescript": 74,
        "java": 62,
        "c": 50,
        "cpp": 54,
        "c++": 54,
        "go": 60,
        "rust": 73,
    }

    def __init__(self, base_url: str | None = None, timeout_seconds: int = 25) -> None:
        self.base_url = (base_url or os.getenv("JUDGE0_BASE_URL", "https://ce.judge0.com")).rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.api_key = os.getenv("JUDGE0_API_KEY")

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-Auth-Token"] = self.api_key
        return headers

    def _resolve_language_id(self, language: str) -> int:
        cleaned = language.strip().lower()
        if cleaned.isdigit():
            return int(cleaned)
        if cleaned in self.DEFAULT_LANGUAGE_MAP:
            return self.DEFAULT_LANGUAGE_MAP[cleaned]
        raise ValueError(f"Unsupported language: {language}")

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

        return result

    def execute(self, code: str, language: str, test_inputs: list[Any]) -> dict[str, Any]:
        language_id = self._resolve_language_id(language)

        normalized_cases = test_inputs if test_inputs else [{"input": "", "expected_output": None}]
        case_results: list[dict[str, Any]] = []

        for case in normalized_cases:
            if isinstance(case, dict):
                stdin = str(case.get("input", case.get("stdin", "")))
                expected_output_value = case.get("expected_output", case.get("output", case.get("expected")))
                expected_output = None if expected_output_value is None else str(expected_output_value)
            else:
                stdin = str(case)
                expected_output = None

            result = self._execute_one(
                code=code,
                language_id=language_id,
                stdin=stdin,
                expected_output=expected_output,
            )
            status = result.get("status") or {}
            status_id = status.get("id")
            stdout_value = result.get("stdout")
            stderr_value = result.get("stderr")
            passed = status_id == 3

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

        return {
            "passed": overall_passed,
            "passed_tests": passed_count,
            "total_tests": total_tests,
            "score": score,
            "time_taken": total_millis,
            "cases": case_results,
        }
