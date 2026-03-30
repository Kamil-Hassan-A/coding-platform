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
- `language` (string)
- `content` (string)
- `solution` (string)
- `source` (string)
- `url` (string)

## JSON Showcase

```json
{
  "schema_version": "1.0.0",
  "dataset_name": "internet_scrape_batch_sample",
  "generated_at_utc": "2026-03-30T18:30:00Z",
  "skills": [
    {
      "skill": "Java",
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
              "language": "Java",
              "content": "Given an array of integers...",
              "solution": "Map<Integer, Integer> map = new HashMap<>(); ...",
              "source": "LeetCode",
              "url": "https://leetcode.com/problems/two-sum/"
            },
            {
              "id": "1",
              "slug": "two-sum",
              "title": "Two Sum",
              "difficulty": "Easy",
              "skill": "Java",
              "skill_level": "Beginner",
              "language": "Java",
              "content": "Given an array of integers...",
              "solution": "Map<Integer, Integer> map = new HashMap<>(); ...",
              "source": "LeetCode",
              "url": "https://leetcode.com/problems/two-sum/"
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
              "language": "Java",
              "content": "Given a string s...",
              "solution": "int l = 0, r = 0; Set<Character> set = new HashSet<>(); ...",
              "source": "LeetCode",
              "url": "https://leetcode.com/problems/longest-substring-without-repeating-characters/"
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
              "language": "SQL",
              "content": "Write a query to report...",
              "solution": "SELECT p.FirstName, p.LastName, a.City, a.State ...",
              "source": "LeetCode",
              "url": "https://leetcode.com/problems/combine-two-tables/"
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
