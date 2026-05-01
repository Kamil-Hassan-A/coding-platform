/**
 * Small helpers used by the SQL HackerRank-style flow.
 *
 *  - `isSqlLikeLanguage`: detects SQL-flavored Monaco language ids.
 *  - `SQL_STARTER_COMMENT`: the standardized comment shown in the editor
 *     when the dataset's `starter_code.sql` is missing or contains hidden
 *     CREATE/INSERT setup that must never reach the candidate.
 */

const SQL_LIKE_LANGUAGES = new Set([
  "sql",
  "mysql",
  "pgsql",
  "plsql",
  "postgresql",
  "tsql",
  "mssql",
  "sqlite",
  "db2",
  "oracle",
]);

export function isSqlLikeLanguage(language: string | null | undefined): boolean {
  if (!language) return false;
  return SQL_LIKE_LANGUAGES.has(String(language).trim().toLowerCase());
}

export const SQL_STARTER_COMMENT = `/*
Enter your query here and follow these instructions:
1. Append a semicolon ";" at the end of the query.
2. Use the table names exactly as shown in the Schema panel.
3. Type your query immediately after this comment block.
*/
`;

export function looksLikeRawSqlSetup(value: string | null | undefined): boolean {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return lowered.includes("create table") || lowered.includes("insert into");
}
