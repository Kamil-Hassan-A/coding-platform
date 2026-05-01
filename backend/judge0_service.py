import logging
import os
import re
import time
from collections import Counter
from typing import Any

import requests

try:
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except Exception:
    pass


logger = logging.getLogger(__name__)


def _judge0_verify_ssl() -> bool:
    """Allow disabling TLS verification when behind corporate proxies.

    Set JUDGE0_VERIFY_SSL=false in `.env` for local dev when the public
    Judge0 CE endpoint is reached through a TLS-inspecting proxy.
    """
    return os.getenv("JUDGE0_VERIFY_SSL", "false").strip().lower() in (
        "1",
        "true",
        "yes",
    )


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


def normalize_output(raw: Any) -> str:
    """Normalize textual output for stable comparisons.

    Per line only (row / record structure unchanged):
      - unify newlines (CRLF/LF)
      - strip leading/trailing line whitespace
      - skip lines that are empty after stripping
      - collapse runs of whitespace *within the line* to a single ASCII space

    Does not reorder, merge, or split logical rows beyond newline boundaries,
    so column boundaries on a row string are preserved as much as SQLite prints them.
    """
    text = "" if raw is None else str(raw)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines_out: list[str] = []
    for line in text.split("\n"):
        segment = line.strip()
        if not segment:
            continue
        collapsed = re.sub(r"\s+", " ", segment)
        lines_out.append(collapsed)
    return "\n".join(lines_out)


def sql_stdout_matches(
    candidate: Any,
    reference: Any,
    *,
    reference_has_order_by: bool = False,
) -> bool:
    """Compare SQLite stdout for evaluation.

    - If the reference SQL used ``ORDER BY`` (``reference_has_order_by``): strict
      match only — normalized strings must match exactly so row order is enforced.
    - Otherwise: tolerant of row permutation — multiset of normalized lines via
      ``Counter`` (duplicate rows counted correctly; no lexicographic sort trick).
    """
    nc = normalize_output(candidate)
    nr = normalize_output(reference)
    if reference_has_order_by:
        return nc == nr
    if nc == nr:
        return True
    lines_a = nc.split("\n") if nc else []
    lines_b = nr.split("\n") if nr else []
    return Counter(lines_a) == Counter(lines_b)


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
        print(f"[JUDGE0] POST {url} verify_ssl={verify} payload_keys={list(payload.keys())}")
        response = requests.post(
            url,
            json=payload,
            headers=self._headers(),
            timeout=self.timeout_seconds,
            verify=verify,
        )
        if not response.ok:
            detail = (response.text or "").strip() or response.reason
            print(
                f"[JUDGE0] ERROR status={response.status_code} body={detail[:500]}"
            )
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

        if setup_sql and setup_sql.strip():
            # SQLite via Judge0 (language_id=82) ignores stdin: the entire
            # SQL script lives in source_code. We prepend the hidden setup
            # so the candidate's query can `SELECT * FROM EMPLOYEES` etc.
            # without ever seeing the CREATE TABLE / INSERT INTO rows.
            final_code = f"{setup_sql.rstrip()}\n\n{user_code_stripped}"
            stdin_to_send = ""
        else:
            final_code = user_code_stripped
            stdin_to_send = stdin if stdin is not None else ""

        print("\n===== SQL EXECUTION DEBUG =====")
        print(f"REQUEST ID    : {request_id}")
        print(f"PROBLEM ID    : {problem_id}")
        print(f"LANGUAGE ID   : {language_id}")
        print(f"HAS SETUP_SQL : {bool(setup_sql and setup_sql.strip())}")
        print("---- SETUP SQL ----")
        print(setup_sql if setup_sql else "<NONE>")
        print("---- USER QUERY ----")
        print(user_code_stripped if user_code_stripped else "<EMPTY>")
        print("---- FINAL EXECUTED SQL ----")
        print(final_code if final_code else "<EMPTY>")
        print(f"---- STDIN ----\n{stdin_to_send}")
        print(f"---- EXPECTED OUTPUT ----\n{expected_output}")
        print("================================\n")

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

        print("===== JUDGE0 RESPONSE =====")
        print(f"REQUEST ID  : {request_id}")
        print(f"PROBLEM ID  : {problem_id}")
        print(f"STATUS      : {result.get('status')}")
        print(f"STDOUT      : {_truncate_text(result.get('stdout'), 800)}")
        print(f"STDERR      : {_truncate_text(result.get('stderr'), 800)}")
        print(f"COMPILE_OUT : {_truncate_text(result.get('compile_output'), 400)}")
        print(f"MESSAGE     : {_truncate_text(result.get('message'), 400)}")
        print("===========================\n")
        logger.info("Judge0 case execution result: %s", _compact_judge0_result(result))
        return result

    def run_sql_reference(
        self,
        *,
        reference_query: str,
        language_id: int,
        setup_sql: str | None = None,
        problem_id: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Run exactly one SQLite query (+ optional hidden setup) with no stdin or expected-output check.

        Used to derive platform \"expected stdout\" when `Problem.solution_text` holds reference SQL.
        """
        q = (reference_query if reference_query is not None else "").strip()
        return self._execute_one(
            code=q,
            language_id=language_id,
            stdin="",
            expected_output=None,
            setup_sql=setup_sql if setup_sql and str(setup_sql).strip() else None,
            problem_id=problem_id,
            request_id=request_id,
        )

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

        print("=== JUDGE0 EXECUTE ===")
        print(f"REQUEST ID      : {request_id}")
        print(f"PROBLEM ID      : {problem_id}")
        print(f"LANGUAGE_ID     : {language_id}")
        print(f"TEST CASE COUNT : {len(test_inputs or [])}")
        print(f"CODE PREVIEW    : {_truncate_text(code, 500)}")
        print(f"HAS SETUP_SQL   : {bool(setup_sql and setup_sql.strip())}")
        print(f"SETUP_SQL LEN   : {len(setup_sql or '')}")
        print(f"SETUP_SQL HEAD  : {_truncate_text(setup_sql, 200)}")
        print("======================")

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
                out_raw = case.get("output", "")
                if setup_sql and str(setup_sql).strip():
                    # Synthetic SQL preview runs send output: "" → do not force Judge0
                    # stdout-vs-expected comparison on an empty expectation.
                    if out_raw is None or (isinstance(out_raw, str) and not str(out_raw).strip()):
                        expected_output = None
                    else:
                        expected_output = str(out_raw)
                else:
                    expected_output = (
                        "" if out_raw is None else str(out_raw)
                    )
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
                passed = (status_id == 3) and normalize_output(stdout_value) == normalize_output(expected_output)

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
        print(
            f"=== JUDGE0 AGGREGATED === passed={passed_count}/{total_tests} score={score} time_ms={total_millis}"
        )
        logger.info(
            "Judge0 aggregated result: passed_tests=%s total_tests=%s score=%s time_taken_ms=%s",
            final_response["passed_tests"],
            final_response["total_tests"],
            final_response["score"],
            final_response["time_taken"],
        )
        return final_response
