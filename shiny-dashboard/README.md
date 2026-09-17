# SMILE Speech Signal — R Shiny dashboard

Reads the two tabs written by the app's Google Apps Script receiver
(`sessions` and `parameters`), joins them on `sessionId`, and presents an
aggregated, filterable dashboard. Designed to deploy to shinyapps.io.

## What it shows

- **Overview** — KPI boxes (sessions, participants, median deviation index,
  flagged parameters), deviation index over time, its distribution, average
  domain scores, and the flag-status breakdown.
- **Parameter profile** — every parameter's z-score for one chosen session,
  coloured by flag, with the ±2 reference edges marked.
- **Parameter trends** — any single parameter (raw value or z) over time,
  per participant.
- **Domain trends** — the five domain scores over time, faceted by participant.
- **Data** — the raw `sessions` and long `parameters` tables.

All tabs respond to the sidebar filters (participants, language, date range).

## 1. Install R packages (once)

```r
install.packages(c(
  "shiny", "bslib", "bsicons", "googlesheets4", "dplyr", "tidyr",
  "ggplot2", "plotly", "DT", "lubridate", "scales", "stringr"
))
```

## 2. Make the Google Sheet readable

Easiest path (what `app.R` is set up for): open the Sheet, **Share → General
access → Anyone with the link → Viewer**. The app then reads it with
`gs4_deauth()` — no login, no secrets.

If the Sheet must stay private, use a Google Cloud **service account**:
1. Create a service-account JSON key.
2. Share the Sheet with the service account's email (Viewer).
3. Put the JSON in this folder and replace `gs4_deauth()` in `app.R` with
   `gs4_auth(path = "service-account.json")`.
4. Deploy the JSON alongside `app.R`. Never commit it to a public repo.

## 3. Run locally

Open `app.R` in RStudio and click **Run App**, or:

```r
shiny::runApp("path/to/shiny-dashboard")
```

## 4. Deploy to shinyapps.io

```r
install.packages("rsconnect")
# copy name/token/secret from your shinyapps.io account -> Tokens
rsconnect::setAccountInfo(name = "youraccount", token = "...", secret = "...")
rsconnect::deployApp("path/to/shiny-dashboard")
```

The whole folder deploys as one app. If you added a service-account JSON,
it uploads with the app.

## Notes

- The sheet URL is set at the top of `app.R` (`SHEET_URL`). Change it there if
  you point at a different sheet.
- Click **Reload from Google Sheet** in the sidebar to pull new sessions
  without restarting the app.
- The dashboard is read-only. It never writes back to the Sheet.
