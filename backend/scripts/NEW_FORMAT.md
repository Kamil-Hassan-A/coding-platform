# 🧱 Question Schema (Unified System)

This schema supports 4 question types:

- `coding` (Judge0-based execution)
- `mcq` (theory / objective)
- `framework` (full-stack / test-harness based)
- `sql` (database query execution)

---

# 🧩 Common Fields (ALL question types)

| Field         | Type           | Description                                  |
| ------------- | -------------- | -------------------------------------------- |
| id            | string         | Unique question identifier                   |
| title         | string         | Human-readable title                         |
| skill         | string         | Skill category (Java, SQL, Agile, etc.)      |
| difficulty    | string         | Easy / Medium / Hard                         |
| level         | string         | Beginner → Specialist_2                      |
| question_type | string         | coding / mcq / framework / sql               |
| tags          | string[]       | Search + filtering tags                      |
| description   | string         | Problem statement (includes examples inline) |
| solution      | string \| null | Reference solution / explanation             |

---

# 💻 1. CODING QUESTION

### ✔ Used for: algorithms, programming problems (Judge0 execution)

---

## 📌 Fields

| Field             | Type   | Description             |
| ----------------- | ------ | ----------------------- |
| starter_code      | object | Language → boilerplate  |
| test_cases        | array  | Public tests            |
| hidden_test_cases | array  | Hidden evaluation tests |

---

## 📦 Example

```json
{
  "id": "q_101",
  "title": "Two Sum",
  "skill": "Java",
  "difficulty": "Easy",
  "level": "Beginner",
  "question_type": "coding",
  "tags": ["arrays", "hashmap", "two-sum"],

  "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nExample:\nInput: [2,7,11,15], 9\nOutput: [0,1]",

  "starter_code": {
    "java": "class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{}; } }"
  },

  "test_cases": [
    { "input": "[2,7,11,15], 9", "output": "[0,1]" },
    { "input": "[3,2,4], 6", "output": "[1,2]" }
  ],

  "hidden_test_cases": [{ "input": "[1,5,3,7]", "output": "[0,3]" }],

  "solution": "Use a hashmap to store complements while iterating. Time complexity O(n), space complexity O(n)."
}
```

---

# 🧠 2. MCQ QUESTION

### ✔ Used for: theory, concepts, Agile, DBMS, etc.

---

## 📌 Fields

| Field                | Type     | Description             |
| -------------------- | -------- | ----------------------- |
| options              | string[] | Answer choices          |
| correct_option_index | number   | Index of correct answer |

---

## 📦 Example

```json
{
  "id": "q_202",
  "title": "Agile Principles",
  "skill": "Agile",
  "difficulty": "Easy",
  "level": "Beginner",
  "question_type": "mcq",
  "tags": ["agile", "scrum", "theory"],

  "description": "Which of the following is a core principle of Agile methodology?",

  "options": [
    "Working software over comprehensive documentation",
    "Fixed requirements upfront",
    "Strict hierarchical planning",
    "Avoiding customer feedback"
  ],

  "correct_option_index": 0,

  "solution": "Agile emphasizes iterative development and values working software over documentation-heavy processes."
}
```

---

# 🧪 3. FRAMEWORK QUESTION

### ✔ Used for: FastAPI, React apps

---

## 📌 Fields

| Field         | Type     | Description            |
| ------------- | -------- | ---------------------- |
| starter_files | object[] | Project file structure |
| entry_point   | string   | Test file entry        |
| test_harness  | string   | Executable test code   |

---

## 📦 Example

```json
{
  "id": "q_303",
  "title": "FastAPI Sum Endpoint",
  "skill": "Python FastAPI",
  "difficulty": "Medium",
  "level": "Intermediate_1",
  "question_type": "framework",
  "tags": ["fastapi", "backend", "api"],

  "description": "Create a FastAPI endpoint '/sum' that takes two query parameters a and b and returns their sum.",

  "starter_files": [
    {
      "path": "main.py",
      "content": "from fastapi import FastAPI\n\napp = FastAPI()\n\n# implement /sum endpoint"
    }
  ],

  "entry_point": "test_main.py",

  "test_harness": "from fastapi.testclient import TestClient\nfrom main import app\n\nclient = TestClient(app)\n\ndef test_sum_1():\n    response = client.get('/sum?a=2&b=3')\n    assert response.json()['result'] == 5\n\ndef test_sum_2():\n    response = client.get('/sum?a=10&b=20')\n    assert response.json()['result'] == 30",

  "solution": null
}
```

---

# 💾 4. SQL QUESTION

### ✔ Used for: database queries, schema design

---

## 📌 Fields

| Field             | Type  | Description             |
| ----------------- | ----- | ----------------------- |
| schema            | array | Table structures        |
| test_cases        | array | Public tests with setup |
| hidden_test_cases | array | Hidden eval with setup  |

---

## 📦 Example

```json
{
  "id": "q_401",
  "title": "Second Highest Salary",
  "skill": "SQL",
  "difficulty": "Easy",
  "level": "Beginner",
  "question_type": "sql",
  "tags": ["sql", "aggregation", "ranking"],

  "description": "Write an SQL query to find the second highest salary from the Employee table.",

  "schema": [
    {
      "table": "Employee",
      "columns": [
        { "name": "id", "type": "INT" },
        { "name": "salary", "type": "INT" }
      ]
    }
  ],

  "test_cases": [
    {
      "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 100);\nINSERT INTO Employee VALUES (2, 200);\nINSERT INTO Employee VALUES (3, 300);\n\nSELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);",
      "output": "200\n"
    },
    {
      "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 50);\nINSERT INTO Employee VALUES (2, 50);\nINSERT INTO Employee VALUES (3, 40);\n\nSELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);",
      "output": "40\n"
    }
  ],

  "hidden_test_cases": [
    {
      "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 10);\nINSERT INTO Employee VALUES (2, 20);\nINSERT INTO Employee VALUES (3, 20);\nINSERT INTO Employee VALUES (4, 30);\n\nSELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);",
      "output": "20\n"
    },
    {
      "input": "CREATE TABLE Employee (id INT, salary INT);\nINSERT INTO Employee VALUES (1, 100);\n\nSELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);",
      "output": "NULL\n"
    }
  ],

  "solution": "SELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);"
}
```

---
