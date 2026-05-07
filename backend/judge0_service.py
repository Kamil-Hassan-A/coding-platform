import base64
import io
import logging
import os
import re
import time
import zipfile
from typing import Any

import requests

try:
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass


logger = logging.getLogger(__name__)


def _judge0_verify_ssl() -> bool:
    return os.getenv("JUDGE0_VERIFY_SSL", "false").strip().lower() in ("1", "true", "yes")


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
        verify = _judge0_verify_ssl()
        response = requests.post(
            url,
            json=payload,
            headers=self._headers(),
            timeout=self.timeout_seconds,
            verify=verify,
        )
        if not response.ok:
            detail = (response.text or "").strip() or response.reason
            logger.error(
                "Judge0 submission rejected: status=%s url=%s body=%s payload_keys=%s",
                response.status_code,
                url,
                detail[:2000],
                list(payload.keys()),
            )
            raise requests.HTTPError(
                f"{response.status_code} {response.reason} — Judge0 says: {detail[:500]}",
                response=response,
            )
        return response.json()

    def _get_submission(self, token: str) -> dict[str, Any]:
        url = f"{self.base_url}/submissions/{token}?base64_encoded=false"
        verify = _judge0_verify_ssl()
        response = requests.get(
            url,
            headers=self._headers(),
            timeout=self.timeout_seconds,
            verify=verify,
        )
        response.raise_for_status()
        return response.json()

    def _execute_one(
        self,
        code: str,
        language_id: int,
        stdin: str,
        expected_output: str | None,
        setup_sql: str | None = None,
        problem_id: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:

        user_code = (code if code is not None else "") or ""
        user_code_stripped = user_code.strip()

        if not user_code_stripped:
            raise ValueError(
                "No program was sent to the code runner. Enter your solution in the editor, then run again."
            )

        if language_id == 82:
            # SQLite (language_id=82) ignores stdin; the full script goes in source_code.
            # Prepend the hidden setup so the candidate's query runs against a seeded DB.
            setup = (setup_sql.rstrip() + "\n\n") if setup_sql and setup_sql.strip() else ""
            final_code = f"{setup}{user_code_stripped}"
            stdin_to_send = ""
        else:
            final_code = user_code_stripped
            stdin_to_send = stdin if stdin is not None else ""

        payload: dict[str, Any] = {
            "source_code": final_code,
            "language_id": language_id,
            "stdin": stdin_to_send,
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

    def _build_multifile_archive(
        self,
        *,
        files: list[dict[str, Any]],
        entry_point: str,
    ) -> str:
        if not files:
            raise ValueError("Multi-file execution requires at least one file.")

        entry_path = (entry_point or "").strip() or "test_solution.py"
        entry_present = any(
            isinstance(entry, dict) and str(entry.get("path") or "").strip() == entry_path
            for entry in files
        )
        if not entry_present:
            raise ValueError(f"Entry point file not found: {entry_path}")

        if entry_path.endswith((".test.js", ".test.jsx", ".test.ts", ".test.tsx")):
            run_script = (
                "#!/usr/bin/env bash\n"
                "set -e\n"
                f"npx jest {entry_path} --no-coverage\n"
            )
        else:
            run_script = (
                "#!/usr/bin/env bash\n"
                "set -e\n"
                f"python {entry_path}\n"
            )

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("run", run_script)
            for entry in files:
                if not isinstance(entry, dict):
                    continue
                path = str(entry.get("path") or "").strip()
                content = entry.get("content")
                if not path or not isinstance(content, str):
                    continue
                zf.writestr(path, content)

        return base64.b64encode(buffer.getvalue()).decode("ascii")

    def execute_multifile(
        self,
        *,
        files: list[dict[str, Any]],
        entry_point: str,
        problem_id: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        additional_files = self._build_multifile_archive(
            files=files,
            entry_point=entry_point,
        )

        payload: dict[str, Any] = {
            "language_id": 89,
            "additional_files": additional_files,
        }

        result = self._post_submission(payload, wait=True)
        normalized_status, normalized_error = map_status(result)
        status_obj = result.get("status")
        status = status_obj if isinstance(status_obj, dict) else {"id": 0, "description": "Unknown"}
        status_id = status.get("id")
        passed = status_id == 3

        case_result = {
            "token": result.get("token"),
            "stdin": "",
            "expected_output": None,
            "stdout": result.get("stdout"),
            "stderr": result.get("stderr"),
            "compile_output": result.get("compile_output"),
            "message": result.get("message"),
            "status": status,
            "time": result.get("time"),
            "memory": result.get("memory"),
            "normalized_status": normalized_status,
            "normalized_error": normalized_error,
            "passed": passed,
        }

        total_millis = 0
        try:
            seconds = float(case_result.get("time") or 0)
        except (TypeError, ValueError):
            seconds = 0
        total_millis = int(seconds * 1000)

        return {
            "passed": passed,
            "passed_tests": 1 if passed else 0,
            "total_tests": 1,
            "score": 100 if passed else 0,
            "time_taken": total_millis,
            "cases": [case_result],
        }

    def execute(
        self,
        code: str,
        language_id: int,
        test_inputs: list[Any],
        setup_sql: str | None = None,
        problem_id: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(language_id, int) or language_id <= 0:
            raise ValueError(f"Invalid Judge0 language id: {language_id}")

        logger.info(
            "Judge0 execute: language_id=%s code=%s test_count=%s",
            language_id,
            _truncate_text(code),
            len(test_inputs or []),
        )

        normalized_cases = test_inputs if test_inputs else [{"input": "", "output": ""}]
        case_results: list[dict[str, Any]] = []

        for case in normalized_cases:
            if isinstance(case, dict):
                stdin = str(case.get("input", ""))
                out_raw = case.get("output", "")
                if setup_sql and str(setup_sql).strip():
                    expected_output = None if out_raw is None or not str(out_raw).strip() else str(out_raw)
                else:
                    expected_output = "" if out_raw is None else str(out_raw)
            else:
                stdin = str(case)
                expected_output = None

            result = self._execute_one(
                code=code,
                language_id=language_id,
                stdin=stdin,
                expected_output=expected_output,
                setup_sql=setup_sql,
                problem_id=problem_id,
                request_id=request_id,
            )
            logger.info("Judge0 raw response: %s", _compact_judge0_result(result))
            normalized_status, normalized_error = map_status(result)
            status_obj = result.get("status")
            status = status_obj if isinstance(status_obj, dict) else {"id": 0, "description": "Unknown"}
            status_id = status.get("id")
            stdout_value = result.get("stdout")
            stderr_value = result.get("stderr")
            if expected_output is None:
                passed = status_id == 3
            else:
                passed = status_id == 3 and (result.get("stdout") or "").strip() == (expected_output or "").strip()

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
        score = int((passed_count / total_tests) * 100) if total_tests > 0 else 0

        total_millis = 0
        for item in case_results:
            try:
                seconds = float(item.get("time") or 0)
            except (TypeError, ValueError):
                seconds = 0
            total_millis += int(seconds * 1000)

        logger.info(
            "Judge0 aggregated: passed=%s/%s score=%s time_ms=%s",
            passed_count, total_tests, score, total_millis,
        )
        return {
            "passed": passed_count == total_tests,
            "passed_tests": passed_count,
            "total_tests": total_tests,
            "score": score,
            "time_taken": total_millis,
            "cases": case_results,
        }
