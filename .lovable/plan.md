## מערכת עורך ויזואלי ל-GitHub Repos של Lovable

מערכת מלאה שמחברת משתמש ל-GitHub, טוענת ריפו של פרויקט Lovable, מציגה אותו בתוך עורך ויזואלי, ודוחפת את השינויים חזרה ל-GitHub כ-PR.

---

### זרימת משתמש

1. משתמש נכנס, מתחבר עם GitHub OAuth
2. בוחר ריפו מתוך הרשימה (או מזין `owner/repo`)
3. המערכת מושכת את הקוד, מריצה build בענן עם הזרקת `data-loc`
4. הפרויקט מוצג ב-iframe לצד פאנל העורך הוויזואלי
5. המשתמש לוחץ על אלמנט → עורך טקסט/צבע/spacing/typography
6. שינויים נצברים כ-diff מקומי + תצוגה מקדימה חיה
7. לחיצה על "Save to GitHub" → יוצר branch, commit, ופותח PR

---

### שלבי בנייה

**שלב 1 — בסיס**
- הפעלת Lovable Cloud (auth + DB + storage)
- טבלאות: `github_connections` (token, github_username), `projects` (repo_owner, repo_name, default_branch), `edit_sessions` (project_id, branch, status), `pending_changes` (session_id, file_path, original, modified, element_loc)
- RLS לכל הטבלאות
- מסכי Login / Dashboard / Project view

**שלב 2 — חיבור GitHub OAuth**
- רישום GitHub OAuth App (המשתמש יקבל הוראות + צריך לתת CLIENT_ID/CLIENT_SECRET כ-secrets)
- TanStack server route ב-`/api/public/github/callback` שמחליף code ל-access_token ושומר ב-DB מוצפן
- scopes: `repo`, `read:user`
- server functions: `listRepos`, `getRepoTree`, `getFileContent`, `createBranch`, `commitFiles`, `openPullRequest` (משתמשים ב-Octokit מול REST API)

**שלב 3 — Build & Render בענן**
- server function `buildProject`: clone shallow → npm install → vite build → אחסון ה-dist ב-storage bucket → החזרת URL
- Vite plugin מותאם (`vite-plugin-loc-injector`) שמוזרק לזמן build ומוסיף `data-loc="file:line:col"` ו-`data-component="Name"` לכל JSX element. נכתב כקובץ קטן ב-`/tmp/build-workspace/vite.config-injected.ts`
- ה-dist מוגש דרך `/api/public/preview/:sessionId/*` עם CSP מתאים ל-iframe
- כשמדובר בפרויקט גדול: אזהרת timeout, ושמירת build cache לפי commit SHA

**שלב 4 — עורך ויזואלי**
- שימוש בקובץ `VisualEditorOverlay.tsx` שהעלית כבסיס (4871 שורות) — מותאם לקרוא `data-loc` מהאלמנט הנבחר
- העורך רץ ב-parent window, מתקשר עם ה-iframe דרך `postMessage`: hover/select/style-change events
- סקריפט injection ב-iframe ש:
  - מאזין ל-click/hover ושולח את `data-loc` של האלמנט להורה
  - מקבל style overrides ומחיל אותם חיה (לפני commit)
- העורך תומך ב: טקסט, צבעים (mapping ל-tokens מ-`styles.css`), spacing, typography, classes של Tailwind, החלפת תמונות (העלאה ל-repo)

**שלב 5 — מיפוי שינוי לקוד**
- כל שינוי בעורך → ממיר ל-AST patch בקובץ המקור
- שימוש ב-`@babel/parser` + `@babel/traverse` ב-server function `applyEdit`:
  - מקבל `{file, line, col, change}` 
  - פותח את הקובץ, מוצא את ה-JSX element באותו location, משנה props/className/children
  - מחזיר את הקובץ המעודכן
- שמירה ב-`pending_changes` עד שהמשתמש מאשר

**שלב 6 — Commit ל-GitHub**
- מסך "Review changes" — diff per file
- "Push to GitHub" → server function:
  - יוצר branch `lovable-visual-edit-{timestamp}`
  - commits לכל הקבצים ששונו (Git Data API: blobs → tree → commit → update ref)
  - פותח PR עם תיאור של השינויים
- חזרה למשתמש עם קישור ל-PR

**שלב 7 — שיפורים**
- Rebuild אוטומטי אחרי merge
- Undo/Redo בעורך (כבר קיים ב-overlay)
- Branch picker
- Conflict detection (אם הריפו השתנה מאז ה-build)
- Rollback של session

---

### פרטים טכניים

**Stack**
- Frontend: TanStack Start (קיים), React 19, Tailwind v4
- Backend: server functions של TanStack + server routes ל-OAuth callback ו-preview proxy
- DB/Auth/Storage: Lovable Cloud
- GitHub: Octokit (`@octokit/rest`)
- AST: `@babel/parser`, `@babel/traverse`, `@babel/generator`, `recast` (לשמירת פורמט)
- Build sandboxing: ה-build רץ בתוך server function — יש מגבלת זמן של Worker (~30s לפרויקטים קטנים). פרויקטים גדולים ידרשו queue + worker חיצוני (יצוין כמגבלה ב-MVP)

**Secrets נדרשים**
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY` (להצפנת tokens ב-DB)

**מגבלות ידועות**
- ה-Worker runtime לא יכול להריץ `vite build` של פרויקטים גדולים בתוך 30 שניות — נצטרך לחשוב על פתרון (build חיצוני / Cloudflare Container / שירות build נפרד) בהמשך השלב השני. ב-MVP נתמוך בפרויקטים קטנים בלבד.
- מיפוי AST עובד מצוין על JSX רגיל; אלמנטים שנוצרים דינמית (`.map`) ידרשו טיפול מיוחד — נסמן אותם כ"לא ניתן לעריכה ישירה" ונציע עריכה של ה-template.
- העורך עובד רק על פרויקטים שהוקמו עם Vite + React (כל פרויקטי Lovable עומדים בקריטריון).

---

### סדר עבודה מומלץ

קוד גדול — עדיף להתחיל קטן ולגדול:
1. שלבים 1-2 (auth + GitHub connection + הצגת רשימת ריפוז וקבצים)
2. שלב 6 בלי עורך (commit ידני של שינוי טקסט פשוט בקובץ נבחר — לוודא ש-end-to-end עובד)
3. שלבים 3-5 (build, render, עורך) — הצרה הגדולה
4. שלב 7 (פוליש)

האם להתחיל מהשלבים 1-2 כצעד ראשון, או שיש מעדיפות אחרת?
