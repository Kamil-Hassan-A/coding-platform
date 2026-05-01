"""Utilities for SQL problem schema handling.

Two responsibilities:

1. Extract a clean SQL setup script (CREATE TABLE / INSERT INTO / ...)
   that the backend privately prepends to the candidate's query before
   sending it to Judge0 SQLite.

2. Produce a structured schema list (table name + columns) that is safe
   to render in the candidate-facing UI without ever leaking the raw
   `INSERT INTO` rows.

The structured schema is what the HackerRank-style "Schema Definition"
panel renders. It is computed in this order of preference:

  a) starter_code["__schema__"]            (explicit, preferred)
  b) starter_code["__hidden_setup__"]      (parsed from CREATE TABLEs)
  c) starter_code["default"]               (legacy convention)
  d) sample/hidden test_case[].input       (legacy convention)

If none of those produce CREATE TABLE statements, the schema is empty
and the UI falls back to showing only the description.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

# A CREATE TABLE statement, terminated by `;`. Captures table name
# and the column body between the outermost parentheses.
_CREATE_TABLE_RE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?[`\"\[]?(?P<name>[A-Za-z_][A-Za-z0-9_]*)[`\"\]]?\s*\((?P<body>.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)

# A column definition inside the CREATE TABLE body.
# Skips lines that start with PRIMARY KEY / FOREIGN KEY / CONSTRAINT / UNIQUE.
_TABLE_LEVEL_KEYWORDS = (
    "primary", "foreign", "constraint", "unique", "check", "key", "index",
)


def _split_top_level(body: str) -> list[str]:
    """Split a CREATE TABLE body on commas that are not inside parens."""
    chunks: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in body:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            chunks.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        chunks.append("".join(current).strip())
    return [chunk for chunk in chunks if chunk]


def _parse_columns(body: str) -> list[dict[str, str]]:
    columns: list[dict[str, str]] = []
    for chunk in _split_top_level(body):
        head = chunk.lstrip().lower()
        if head.startswith(_TABLE_LEVEL_KEYWORDS):
            continue
        # Strip leading backticks/quotes around the column name.
        m = re.match(
            r"[`\"\[]?(?P<name>[A-Za-z_][A-Za-z0-9_]*)[`\"\]]?\s+(?P<type>[^,]+?)(?:\s+(?:NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|DEFAULT\s+\S+|AUTO_?INCREMENT|REFERENCES\s+.+))?\s*$",
            chunk.strip(),
            re.IGNORECASE,
        )
        if not m:
            # Fallback: just take first two whitespace-separated tokens.
            parts = chunk.strip().split(None, 1)
            if len(parts) < 2:
                continue
            name, dtype = parts[0], parts[1]
        else:
            name, dtype = m.group("name"), m.group("type")
        # Normalize the type: keep only the leading type token (e.g. VARCHAR(20))
        dtype_clean = re.sub(r"\s+", " ", dtype).strip().rstrip(",")
        # Strip table-level constraints that may have leaked into the type.
        dtype_clean = re.split(
            r"\b(PRIMARY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|NOT\s+NULL|NULL)\b",
            dtype_clean,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip().rstrip(",")
        columns.append({"name": name, "type": dtype_clean.upper() or "TEXT"})
    return columns


def parse_create_tables(sql_text: str | None) -> list[dict[str, Any]]:
    """Parse CREATE TABLE statements out of an arbitrary SQL setup blob."""
    if not sql_text or not isinstance(sql_text, str):
        return []
    schema: list[dict[str, Any]] = []
    for match in _CREATE_TABLE_RE.finditer(sql_text):
        name = match.group("name")
        body = match.group("body")
        cols = _parse_columns(body)
        if not cols:
            continue
        schema.append({"table": name.upper(), "columns": cols})
    return schema


def _first_string(values: Iterable[Any]) -> str:
    for v in values:
        if isinstance(v, str) and v.strip():
            return v
    return ""


def get_hidden_sql_setup(
    starter_code: Any,
    sample_test_cases: list[Any] | None = None,  # noqa: ARG001 — kept for API compat
    hidden_test_cases: list[Any] | None = None,  # noqa: ARG001 — kept for API compat
) -> str:
    """Resolve the raw CREATE/INSERT script that should run BEFORE the user's query.

    STRICT: only `starter_code["__hidden_setup__"]` is consulted. Test-case
    inputs are NEVER used as setup — they are candidate-facing example
    inputs/outputs and frequently contain mismatched/junk schemas.

    Never sent to the frontend. Only used by Judge0 execution.
    """
    if not isinstance(starter_code, dict):
        return ""
    explicit = starter_code.get("__hidden_setup__")
    if isinstance(explicit, str) and explicit.strip():
        return explicit
    return ""


def get_visible_schema(
    starter_code: Any,
    sample_test_cases: list[Any] | None = None,
    hidden_test_cases: list[Any] | None = None,
) -> list[dict[str, Any]]:
    """Resolve the structured schema that IS safe to send to the frontend."""
    if isinstance(starter_code, dict):
        explicit = starter_code.get("__schema__")
        if isinstance(explicit, list):
            cleaned: list[dict[str, Any]] = []
            for entry in explicit:
                if not isinstance(entry, dict):
                    continue
                table = str(entry.get("table") or "").strip()
                cols_raw = entry.get("columns") or []
                if not table or not isinstance(cols_raw, list):
                    continue
                cols: list[dict[str, str]] = []
                for col in cols_raw:
                    if not isinstance(col, dict):
                        continue
                    name = str(col.get("name") or "").strip()
                    ctype = str(col.get("type") or "").strip()
                    if not name:
                        continue
                    cols.append({"name": name, "type": ctype or "TEXT"})
                if cols:
                    cleaned.append({"table": table.upper(), "columns": cols})
            if cleaned:
                return cleaned

    setup = get_hidden_sql_setup(starter_code, sample_test_cases, hidden_test_cases)
    return parse_create_tables(setup)


def sanitize_starter_code_for_payload(starter_code: Any) -> Any:
    """Strip private keys (`__hidden_setup__`, `__schema__`, `default`) before sending to UI.

    `default` is also dropped for SQL because legacy datasets stored the raw
    CREATE/INSERT script there. We never want the candidate to see that.
    """
    if not isinstance(starter_code, dict):
        return starter_code
    cleaned: dict[str, Any] = {}
    for key, value in starter_code.items():
        if key in ("__hidden_setup__", "__schema__"):
            continue
        if key == "default":
            # If it looks like raw CREATE TABLE setup, drop it.
            if isinstance(value, str) and re.search(r"create\s+table", value, re.IGNORECASE):
                continue
        cleaned[key] = value
    return cleaned


# Standardized HackerRank-style starter comment shown when the dataset
# does not provide a clean `sql` boilerplate (or contains hidden setup).
SQL_STARTER_COMMENT = (
    "/*\n"
    "Enter your query here and follow these instructions:\n"
    "1. Append a semicolon \";\" at the end of the query.\n"
    "2. Use the table names exactly as shown in the Schema panel.\n"
    "3. Type your query immediately after this comment block.\n"
    "*/\n"
)


def looks_like_raw_setup(value: Any) -> bool:
    """True when a string clearly contains hidden CREATE/INSERT setup."""
    if not isinstance(value, str):
        return False
    lowered = value.lower()
    return ("create table" in lowered) or ("insert into" in lowered)


def normalize_sql_starter(_sql_starter: Any = None) -> str:
    """Return the standardized HackerRank-style SQL editor placeholder.

    We INTENTIONALLY ignore the dataset's `sql` field because some problems
    historically stored the full reference solution there (e.g. recursive
    CTEs with the answer pre-filled). The candidate must always start with
    a clean editor and write their own query.
    """
    return SQL_STARTER_COMMENT
