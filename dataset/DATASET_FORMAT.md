# Scrape Dataset Format (Sample)

This format is designed for your requirement:

- Exactly 19 skills
- Each skill has 5 levels
- Each level has 3 difficulty buckets: Easy, Medium, Hard

## Canonical Skills (19)

1. Agile
2. HTML, CSS, JS
3. React JS
4. React JS with Redux
5. TypeScript
6. Next JS
7. Angular
8. Python with Flask
9. Python with Django
10. Python for Data Science
11. Java
12. Java Spring Boot
13. .NET, C#
14. .NET, VB.NET
15. SQL
16. MongoDB
17. PostgreSQL
18. Java Selenium
19. Python Selenium

## Canonical Levels (5)

Use these exact keys:

1. Beginner
2. Intermediate_1
3. Intermediate_2
4. Specialist_1
5. Specialist_2

## JSON Contract

### Top-level

- `schema_version` (string)
- `dataset_name` (string)
- `generated_at_utc` (ISO string)
- `skills` (array of 19 skill objects)

### Skill object

- `skill` (string, one of the 19 canonical skills)
- `allowed_languages` (array of language descriptors accepted for this skill)
  - Each item shape: `{ "id": number, "name": string, "monaco": string }`
- `levels` (object with exactly 5 level keys)

### Level object

- `Easy` (array of question objects)
- `Medium` (array of question objects)
- `Hard` (array of question objects)

### Question object (minimum)

- `id` (string)
- `slug` (string)
- `title` (string)
- `difficulty` (`Easy` | `Medium` | `Hard`)
- `skill` (string)
- `skill_level` (one of 5 levels)
- `tags` (array of strings)
- `starter_code` (object, recommended keys: `default`, `python`, `javascript`, `java`, etc.)
- `sample_test_cases` (array of `{ "input": string, "output": string }`)
- `hidden_test_cases` (array of `{ "input": string, "output": string }`, optional)
- `content` (string)
- `solution` (string)

## JSON Showcase

```json
{
  "schema_version": "1.0.0",
  "dataset_name": "internet_scrape_batch_sample",
  "generated_at_utc": "2026-03-30T18:30:00Z",
  "skills": [
    {
      "skill": "Java",
      "allowed_languages": [
        {
          "id": 62,
          "name": "Java (OpenJDK 13.0.1)",
          "monaco": "java"
        }
      ],
      "levels": {
        "Beginner": {
          "Easy": [
            {
              "id": "1",
              "slug": "two-sum",
              "title": "Two Sum",
              "difficulty": "Easy",
              "skill": "Java",
              "skill_level": "Beginner",
              "tags": ["arrays", "hashmap", "beginner"],
              "starter_code": {
                "default": "public class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{}; } }",
                "java": "public class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{}; } }"
              },
              "sample_test_cases": [
                { "input": "[2,7,11,15]\n9", "output": "[0,1]" }
              ],
              "hidden_test_cases": [
                { "input": "[3,2,4]\n6", "output": "[1,2]" }
              ],
              "content": "Given an array of integers...",
              "solution": "Map<Integer, Integer> map = new HashMap<>(); ...",
            },
            {
              "id": "9",
              "slug": "palindrome-number",
              "title": "Palindrome Number",
              "difficulty": "Easy",
              "skill": "Java",
              "skill_level": "Beginner",
              "tags": ["math", "strings", "beginner"],
              "starter_code": {
                "default": "public class Solution { public boolean isPalindrome(int x) { return false; } }",
                "java": "public class Solution { public boolean isPalindrome(int x) { return false; } }"
              },
              "sample_test_cases": [
                { "input": "121", "output": "true" }
              ],
              "hidden_test_cases": [
                { "input": "10", "output": "false" }
              ],
              "content": "Given an integer x, return true if x is a palindrome...",
              "solution": "Reverse half of the number and compare...",
            }
          ],
          "Medium": [
            {
              "id": "3",
              "slug": "longest-substring-without-repeating-characters",
              "title": "Longest Substring Without Repeating Characters",
              "difficulty": "Medium",
              "skill": "Java",
              "skill_level": "Beginner",
              "tags": ["sliding-window", "hashset", "strings"],
              "starter_code": {
                "default": "public class Solution { public int lengthOfLongestSubstring(String s) { return 0; } }",
                "java": "public class Solution { public int lengthOfLongestSubstring(String s) { return 0; } }"
              },
              "sample_test_cases": [
                { "input": "abcabcbb", "output": "3" }
              ],
              "hidden_test_cases": [
                { "input": "bbbbb", "output": "1" }
              ],
              "content": "Given a string s...",
              "solution": "int l = 0, r = 0; Set<Character> set = new HashSet<>(); ...",
            }
          ],
          "Hard": []
        },
        "Intermediate_1": {
          "Easy": [],
          "Medium": [],
          "Hard": []
        },
        "Intermediate_2": {
          "Easy": [],
          "Medium": [],
          "Hard": []
        },
        "Specialist_1": {
          "Easy": [],
          "Medium": [],
          "Hard": []
        },
        "Specialist_2": {
          "Easy": [],
          "Medium": [],
          "Hard": []
        }
      }
    },
    {
      "skill": "SQL",
      "levels": {
        "Beginner": {
          "Easy": [
            {
              "id": "175",
              "slug": "combine-two-tables",
              "title": "Combine Two Tables",
              "difficulty": "Easy",
              "skill": "SQL",
              "skill_level": "Beginner",
              "tags": ["joins", "select", "beginner"],
              "starter_code": {
                "default": "SELECT p.firstName, p.lastName, a.city, a.state FROM Person p LEFT JOIN Address a ON p.personId = a.personId;",
                "sql": "SELECT p.firstName, p.lastName, a.city, a.state FROM Person p LEFT JOIN Address a ON p.personId = a.personId;"
              },
              "sample_test_cases": [
                { "input": "Person + Address tables as provided", "output": "Expected joined rows" }
              ],
              "hidden_test_cases": [
                { "input": "Person row without Address", "output": "NULL city/state" }
              ],
              "content": "Write a query to report...",
              "solution": "SELECT p.FirstName, p.LastName, a.City, a.State ...",
            }
          ],
          "Medium": [],
          "Hard": []
        },
        "Intermediate_1": { "Easy": [], "Medium": [], "Hard": [] },
        "Intermediate_2": { "Easy": [], "Medium": [], "Hard": [] },
        "Specialist_1": { "Easy": [], "Medium": [], "Hard": [] },
        "Specialist_2": { "Easy": [], "Medium": [], "Hard": [] }
      }
    }
  ]
}
```

## Validation Rules

- `skills.length` must be exactly 19
- Every skill must include all 5 levels
- Every level must include `Easy`, `Medium`, `Hard` arrays
- Each question's `difficulty` must match its bucket
- Each question's `skill` and `skill_level` must match parent nodes
