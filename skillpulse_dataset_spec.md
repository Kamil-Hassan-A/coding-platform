# SkillPulse Dataset Spec
**Version 2.0 — May 2026**

---

## Section 1 — Overview

SkillPulse is an internal coding assessment platform used to evaluate candidate skills through timed coding and multiple-choice assessments. The platform stores question datasets in PostgreSQL, serves assessment payloads through FastAPI, renders them in a React + TypeScript frontend, and uses Judge0 for code execution.

SkillPulse supports three question types:

| `question_type` | Description | Execution | Example Skills |
|---|---|---|---|
| `coding` | Candidate writes a function in a programming language | Judge0 | Python, Java, .NET |
| `mcq` | Candidate picks one of four options | None | Agile |
| `coding` (language: sql) | Candidate writes a SQL query | Judge0 (SQLite) | SQL, PostgreSQL |

> SQL questions use `question_type = "coding"` with `language = "sql"`. They are distinguished at runtime by their Monaco language key, not by a separate question_type value.

---

## Section 2 — Database Schema (problems table)

### Shared Fields (all question types)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `skill_id` | UUID | No | FK to skills table |
| `level` | Enum | No | See level values below |
| `title` | String(255) | No | Short question title |
| `description` | Text | No | Full problem statement shown to candidate |
| `time_limit_minutes` | Integer | No | Default 45 |
| `tags` | JSON | No | Array of lowercase strings |
| `difficulty_label` | String(50) | Yes | `"Easy"`, `"Medium"`, `"Hard"` |
| `question_type` | String(50) | Yes | `"coding"` or `"mcq"` — null treated as coding |
| `type_data` | JSON | Yes | Type-specific data — MCQ only, null for coding/SQL |
| `source_name` | String(100) | Yes | Source platform e.g. `"LeetCode"` |
| `source_url` | String(1000) | Yes | Link to original problem |
| `source_dataset` | String(100) | Yes | Dataset name |
| `external_task_id` | String(255) | Yes | Source platform ID |
| `created_at` | DateTime | No | Auto-set on insert |

### Coding and SQL Fields

| Column | Type | Nullable | Description |
|---|---|---|---|
| `starter_code` | JSON | Yes | Language-keyed boilerplate dict |
| `sample_test_cases` | JSON | No | Shown during Run — `[{input, output}]` |
| `hidden_test_cases` | JSON | No | Used for scoring at Submit |
| `solution_text` | Text | Yes | Reference solution (internal only) |

### Level Enum Values (exact)

```
beginner
intermediate_1
intermediate_2
specialist_1
specialist_2
```

### `type_data` Shape for MCQ

```json
{
  "options": [
    "Full text of option A",
    "Full text of option B",
    "Full text of option C",
    "Full text of option D"
  ],
  "correct_option": "B"
}
```

`correct_option` is stored server-side only. It is **never sent to the frontend**.

`type_data` is `null` for coding and SQL questions.

### `starter_code` Shape for SQL Questions

SQL questions use a special `starter_code` dict with reserved keys:

| Key | Sent to Frontend | Purpose |
|---|---|---|
| `sql` | Yes (reset to comment block) | Candidate's editor content — always overwritten with a clean comment |
| `__schema__` | No (converted to `schema_tables`) | Table schema shown in the Schema panel |
| `__hidden_setup__` | No | CREATE TABLE + INSERT statements run before the candidate's query in Judge0 |

---

## Section 3 — API Payload (what frontend receives)

`correct_option` is **never** in any API response. `__hidden_setup__` and `__schema__` are **never** sent to the frontend.

### Coding Question

```json
{
  "problem_id": "uuid",
  "title": "Two Sum",
  "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.",
  "templateCode": "def two_sum(nums, target):\n    pass",
  "starter_code": { "python": "...", "java": "..." },
  "tags": ["arrays", "hashmap"],
  "sample_test_cases": [{ "input": "4\n2 7 11 15\n9", "output": "0 1" }],
  "time_limit_minutes": 45,
  "question_type": "coding",
  "type_data": null,
  "schema_tables": []
}
```

### MCQ Question

```json
{
  "problem_id": "uuid",
  "title": "Agile Sprint Goal",
  "description": "What is the primary purpose of a sprint goal in Scrum?",
  "templateCode": null,
  "starter_code": null,
  "tags": ["agile", "scrum"],
  "sample_test_cases": [],
  "time_limit_minutes": 45,
  "question_type": "mcq",
  "type_data": {
    "options": [
      "To describe the single objective that gives the sprint focus.",
      "To list every task each developer must complete.",
      "To replace the product backlog for the sprint duration.",
      "To define the release date for the product."
    ]
  },
  "schema_tables": []
}
```

### SQL Question

```json
{
  "problem_id": "uuid",
  "title": "American Cities by Population",
  "description": "Query all columns for all American cities with populations larger than 100000.",
  "templateCode": "/* Enter your query here ... */\n",
  "starter_code": { "sql": "/* Enter your query here ... */\n" },
  "tags": ["sql", "select"],
  "sample_test_cases": [],
  "time_limit_minutes": 45,
  "question_type": "coding",
  "type_data": null,
  "schema_tables": [
    {
      "table": "CITY",
      "columns": [
        { "name": "ID", "type": "NUMBER" },
        { "name": "NAME", "type": "VARCHAR2(17)" },
        { "name": "COUNTRYCODE", "type": "VARCHAR2(3)" },
        { "name": "DISTRICT", "type": "VARCHAR2(20)" },
        { "name": "POPULATION", "type": "NUMBER" }
      ]
    }
  ]
}
```

---

## Section 4 — Dataset JSON Format

### Coding and MCQ Questions — File Structure

Used by `seed_new.py`. Read from `backend/scripts/problem_dataset.json`.

```json
{
  "skills": [
    {
      "skill": "SkillName",
      "allowed_languages": [
        { "id": 71, "name": "Python (3.8.1)", "monaco": "python" }
      ],
      "levels": {
        "Beginner": {
          "Easy": [ "...questions..." ],
          "Medium": [ "...questions..." ],
          "Hard": [ "...questions..." ]
        },
        "Intermediate_1": { "Easy": [], "Medium": [], "Hard": [] },
        "Intermediate_2": { "Easy": [], "Medium": [], "Hard": [] },
        "Specialist_1":   { "Easy": [], "Medium": [], "Hard": [] },
        "Specialist_2":   { "Easy": [], "Medium": [], "Hard": [] }
      }
    }
  ]
}
```

> **Important:** Level keys are capitalised exactly as shown — `"Beginner"`, `"Intermediate_1"` etc. The seeder will silently skip questions with unrecognised level keys.

> **Important:** The seeder reads question text from `"content"` first, then falls back to `"problem"`. It does **not** read from `"description"`. Use `"content"` as the field name.

### Complete Coding Question Entry

```json
{
  "id": "coding-two-sum-001",
  "slug": "two-sum",
  "title": "Two Sum",
  "question_type": "coding",
  "difficulty": "Easy",
  "content": "Given an array of integers nums and an integer target, print the indices of the two numbers such that they add up to target. Print the lower index first.",
  "tags": ["arrays", "hashmap"],
  "starter_code": {
    "python": "from typing import List\n\n\ndef two_sum(nums: List[int], target: int) -> List[int]:\n    \"\"\"Return the indices of two numbers whose sum equals target.\"\"\"\n    # TODO: implement\n    pass\n\n\nif __name__ == \"__main__\":\n    import sys\n    data = sys.stdin.read().strip().splitlines()\n    n = int(data[0])\n    nums = list(map(int, data[1].split()))\n    target = int(data[2])\n    result = two_sum(nums[:n], target)\n    print(result[0], result[1])\n",
    "java": "import java.io.BufferedReader;\nimport java.io.InputStreamReader;\n\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // TODO: implement\n        return new int[] {-1, -1};\n    }\n\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        int n = Integer.parseInt(br.readLine().trim());\n        String[] parts = br.readLine().trim().split(\"\\\\s+\");\n        int[] nums = new int[n];\n        for (int i = 0; i < n; i++) nums[i] = Integer.parseInt(parts[i]);\n        int target = Integer.parseInt(br.readLine().trim());\n        int[] result = twoSum(nums, target);\n        System.out.println(result[0] + \" \" + result[1]);\n    }\n}\n"
  },
  "sample_test_cases": [
    { "input": "4\n2 7 11 15\n9", "output": "0 1" },
    { "input": "3\n3 2 4\n6",     "output": "1 2" }
  ],
  "hidden_test_cases": [
    { "input": "2\n3 3\n6",             "output": "0 1" },
    { "input": "5\n1 5 9 14 20\n23",   "output": "2 3" },
    { "input": "6\n10 -2 4 8 7 11\n9", "output": "1 5" },
    { "input": "4\n0 4 3 0\n0",        "output": "0 3" }
  ],
  "solution": "Use a hash map from value to index. For each number compute target minus current and return the stored index when the complement exists.",
  "source": null,
  "url": null
}
```

### Complete MCQ Question Entry

```json
{
  "id": "agile-sprint-goal-001",
  "slug": "agile-sprint-goal",
  "title": "Agile Sprint Goal",
  "question_type": "mcq",
  "difficulty": "Easy",
  "content": "What is the primary purpose of a sprint goal in Scrum?",
  "tags": ["agile", "scrum"],
  "options": [
    "To describe the single objective that gives the sprint focus.",
    "To list every task each developer must complete.",
    "To replace the product backlog for the sprint duration.",
    "To define the release date for the product."
  ],
  "correct_option": "A",
  "starter_code": null,
  "sample_test_cases": [],
  "hidden_test_cases": [],
  "solution": null,
  "source": null,
  "url": null
}
```

### SQL Questions — Separate File and Format

SQL questions live in `dataset/sql_problems.json`. This is a flat array (not skills > levels).

```json
[
  {
    "title": "American Cities by Population",
    "description": "Query all columns for all American cities with populations larger than 100000. The CountryCode for America is USA. Order rows by ID ascending.",
    "level": "BEGINNER",
    "tags": [],
    "difficulty_label": "Easy",
    "time_limit_minutes": 45,
    "external_task_id": null,
    "source_name": null,
    "source_url": null,
    "source_dataset": null,
    "solution": "SELECT * FROM CITY WHERE COUNTRYCODE = 'USA' AND POPULATION > 100000 ORDER BY ID ASC;",
    "starter_code": {
      "sql": "/*\nEnter your query here and follow these instructions:\n1. Append a semicolon at the end of the query.\n2. Use the table names exactly as shown in the Schema panel.\n3. Type your query immediately after this comment block.\n*/\n",
      "__schema__": [
        {
          "table": "CITY",
          "columns": [
            { "name": "ID",          "type": "NUMBER" },
            { "name": "NAME",        "type": "VARCHAR2(17)" },
            { "name": "COUNTRYCODE", "type": "VARCHAR2(3)" },
            { "name": "DISTRICT",    "type": "VARCHAR2(20)" },
            { "name": "POPULATION",  "type": "NUMBER" }
          ]
        }
      ],
      "__hidden_setup__": "CREATE TABLE CITY (\n  ID INTEGER PRIMARY KEY,\n  NAME TEXT,\n  COUNTRYCODE TEXT,\n  DISTRICT TEXT,\n  POPULATION INTEGER\n);\nINSERT INTO CITY VALUES (3878, 'Scottsdale', 'USA', 'Arizona', 202705);\nINSERT INTO CITY VALUES (3965, 'Corona', 'USA', 'California', 124966);\n"
    }
  }
]
```

> **SQL level values** must be exactly: `"BEGINNER"`, `"INTERMEDIATE_1"`, `"INTERMEDIATE_2"`, `"SPECIALIST_1"`, `"SPECIALIST_2"` (all caps with underscores).

---

## Section 5 — Rules for Content Authors

### General Rules (all question types)

- `id` must be unique across the entire file — include it for future-proofing
- `slug` must be lowercase and hyphen-separated — include it for future-proofing
- `difficulty` must be exactly: `"Easy"`, `"Medium"`, or `"Hard"`
- `tags` must be an array of lowercase strings
- `question_type` must be exactly `"coding"` or `"mcq"` for coding/MCQ questions — omit for SQL (defaults to `"coding"`)

> `id`, `slug`, `tags`, and `source` are not currently persisted by the seeder. Include them anyway — they will be stored once the seeder is updated.

### Coding Rules

- `starter_code` must include all languages the skill supports
- Each language entry must include the **full boilerplate**: function signature + comment/docstring describing parameters + placeholder (`pass` / return stub) + `main` block with stdin parsing and stdout printing
- Use a descriptive function name matching the problem e.g. `two_sum`, `daily_sales_total`
- Question text goes in `"content"` — **not** `"description"`
- `sample_test_cases`: minimum 2, maximum 4
- `hidden_test_cases`: minimum 4, maximum 10
- `input` and `output` are plain strings exactly matching stdin/stdout
- Do **NOT** include `options` or `correct_option`

### MCQ Rules

- `options` must be exactly **4 strings** — full sentences, not prefixed with A) B) C) D)
- `correct_option` must be exactly one of: `"A"`, `"B"`, `"C"`, `"D"`
- Mapping: A = index 0, B = index 1, C = index 2, D = index 3
- Do **NOT** embed options inside `content` — put them in the `options` array only
- `starter_code` must be `null`
- `sample_test_cases` and `hidden_test_cases` must be `[]` or omitted
- Question text goes in `"content"`

### SQL Rules

- SQL questions go in `dataset/sql_problems.json` — **not** in `problem_dataset.json`
- `level` must be ALL CAPS with underscores: `"BEGINNER"`, `"INTERMEDIATE_1"` etc.
- `starter_code` must have exactly these keys:
  - `"sql"` — the comment block the candidate sees (always reset to a clean comment by the platform)
  - `"__schema__"` — array of table objects with `table` and `columns` (shown in Schema panel)
  - `"__hidden_setup__"` — CREATE TABLE + INSERT statements run before the candidate's query (never shown to candidate)
- `solution` must be a valid SQL query ending with a semicolon
- Do **NOT** include `question_type`, `options`, or `correct_option`
- `sample_test_cases` and `hidden_test_cases` should be `[]` — SQL comparison is done against the reference solution output, not test case strings

---

## Section 6 — Language Reference

| Name | Judge0 ID | Monaco Key |
|---|---|---|
| Python (3.8.1) | 71 | python |
| JavaScript | 63 | javascript |
| TypeScript | 74 | typescript |
| Java | 62 | java |
| C++ | 54 | cpp |
| C# | 51 | csharp |
| SQL (SQLite 3.27.2) | 82 | sql |

> Allowed languages are configured per-skill in the database. Not all skills support all languages. Check with the backend team which languages apply to your skill.

---

## Section 7 — What the Seeder Does

### For `problem_dataset.json` (coding + MCQ) — run via `seed_new.py`

- Reads structure: `skills > levels > difficulty > questions`
- Skill name read from `"skill"` key (not `"name"`)
- Level keys must be capitalised: `"Beginner"`, `"Intermediate_1"` etc.
- Question text read from `"content"` first, then `"problem"` — not `"description"`
- For MCQ: packages `options` + `correct_option` into `type_data` JSON column
- For coding: writes `starter_code`, `sample_test_cases`, `hidden_test_cases` directly
- `type_data` is `null` for coding questions
- `correct_option` is stored inside `type_data` server-side and **never leaves the backend**
- `question_type` defaults to `"coding"` if not present in JSON

### For `sql_problems.json` (SQL) — separate seeder

- Flat array format — no skills/levels nesting
- `level` values are ALL CAPS
- `__hidden_setup__` is stored in `starter_code` and never sent to frontend
- `__schema__` is converted to `schema_tables` in the API payload

---

## Section 8 — Next Steps

| # | Task | Who |
|---|---|---|
| 1 | Prepare Agile MCQ dataset following this spec | Content team |
| 2 | Prepare coding datasets for new skills following this spec | Content team |
| 3 | Add SQL questions to `sql_problems.json` following SQL rules | Content team |
| 4 | Run seeder after dataset is ready | Backend |
| 5 | Verify seeded data in Supabase | Backend |
