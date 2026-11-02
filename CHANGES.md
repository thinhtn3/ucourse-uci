# Changes: playtest feedback (Nov 1, 2026)

## Search
- Course search works in any format: `mgmt 30a`, `informatics 43`, `IN4MATX151`, `INF 151`.
- Suggestions appear as you type. Picked courses become chips, and you can paste a whole list.
- The full UCI catalog is stored in the app (`src/data/courses.json`), so search is instant. Refresh it each quarter with `npm run sync:courses`.

## Ranking
- If the AI model hits its rate limit, the app retries, then switches to a backup model. Courses it still can't assess show their data marked "Not assessed" instead of an error.
- You can enter up to 200 courses. The first 60 get ranked, and the rest get a "Rank these next" button.
- New "Any quarter" option, an online / in-person filter, and a professor picker when several professors teach a course.
- Rows show when a course is usually offered, and flag when only one lecturer teaches it.

## Home page
- ⓘ tooltips explain each box (Term, Courses, What matters).
- Preset chips for "What matters": Easy A, Good lecturer, Light workload, Online, In person.
- One-line instructions for the DegreeWorks import (select all, copy, paste).
- A 5-step "Getting started" guide.

## Results and plan
- After ranking, the search fields move to a left sidebar.
- A legend explains Take it / Take with caveats / Skip.
- Rows are more clearly clickable ("Reviews ›").
- The "Your plan" button is bigger, shows a count, and confirms each course you add.
- The plan can be copied or downloaded as a CSV.

## DegreeWorks import
- Picks up electives, "A or B" choices, wildcards (`IN4MATX 1@`) and ranges (`COMPSCI 113:199`).
- Notes that the worksheet is read in your browser and never uploaded.

## Not included
- Multi-quarter "graduate on time" planning
- Friends' schedules
- A shared cache such as Redis. The current cache lives in server memory and resets on restart.
