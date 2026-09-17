# ==========================================================================
# SMILE Speech Signal Lab — aggregated dashboard
#
# Reads the two tabs written by the Google Apps Script receiver:
#   - "sessions"   : one row per session (wide header: who/when/scores)
#   - "parameters" : one row per measured parameter (long / tidy format)
# joined on sessionId, and presents an analyst-friendly dashboard.
#
# This is a single-file Shiny app (app.R) ready for shinyapps.io.
#
# --------------------------------------------------------------------------
# LOCAL SETUP (run once):
#   install.packages(c(
#     "shiny", "bslib", "googlesheets4", "dplyr", "tidyr", "ggplot2",
#     "plotly", "DT", "lubridate", "scales", "stringr"
#   ))
#
# AUTHENTICATION:
#   Easiest path for shinyapps.io: make the Google Sheet readable by
#   "Anyone with the link (Viewer)" and use gs4_deauth() below. No secrets,
#   no token files. This is what the app is configured for.
#
#   If the sheet must stay private, you need a service account:
#     1. Create a service-account JSON key in Google Cloud.
#     2. Share the Sheet with that service account's email (Viewer).
#     3. Place the JSON in this folder and use:
#          gs4_auth(path = "service-account.json")
#     4. Deploy the JSON alongside app.R (never commit it publicly).
#
# DEPLOY TO shinyapps.io:
#   install.packages("rsconnect")
#   rsconnect::setAccountInfo(name=..., token=..., secret=...)   # from your account
#   rsconnect::deployApp("path/to/shiny-dashboard")
# ==========================================================================

library(shiny)
library(bslib)
library(googlesheets4)
library(dplyr)
library(tidyr)
library(ggplot2)
library(plotly)
library(DT)
library(lubridate)
library(scales)
library(stringr)

# ---- CONFIG --------------------------------------------------------------
SHEET_URL <- "https://docs.google.com/spreadsheets/d/1JVTT4_wByF--IdQxlPJt-akq82RAgJ61w9A021IJzLw/edit"

# Public read-only sheet -> no login. Comment out and use gs4_auth() if private.
gs4_deauth()

# Flag colours reused across every chart
FLAG_COLS <- c(ok = "#22c55e", watch = "#f59e0b", out = "#ef4444")
FLAG_LABS <- c(ok = "Within range", watch = "Borderline", out = "Outside range")

DOMAIN_COLS <- c(
  domain_pronunciation = "Pronunciation",
  domain_intonation    = "Intonation",
  domain_fluency       = "Fluency",
  domain_voice         = "Voice quality",
  domain_clarity       = "Clarity"
)

# ---- DATA LOADING --------------------------------------------------------
# Robust load: tolerate the sheet being empty or a tab missing, coerce types.
# Empty-but-typed templates so filter()/select() never fail on a missing
# column before any data has loaded. Column names match the Apps Script.
EMPTY_SESSIONS <- tibble(
  receivedAt = as_datetime(character()), participant = character(),
  age = character(), sex = character(), language = character(),
  languageName = character(), timepoint = character(),
  recordedAt = as_datetime(character()), analysisRate = double(),
  inputRate = double(), script = character(), tool = character(),
  version = character(), deviationIndex = double(),
  domain_pronunciation = double(), domain_intonation = double(),
  domain_fluency = double(), domain_voice = double(),
  domain_clarity = double(), transcript_read = character(),
  transcript_free = character(), sessionId = character()
)
EMPTY_PARAMS <- tibble(
  receivedAt = as_datetime(character()), sessionId = character(),
  participant = character(), timepoint = character(), language = character(),
  recordedAt = as_datetime(character()), parameter = character(),
  label = character(), value = double(), unit = character(),
  task = character(), z = double(),
  flag = factor(character(), levels = names(FLAG_COLS)),
  provisional = integer()
)

load_data <- function() {
  read_err <- NULL
  safe_read <- function(sheet, empty) {
    out <- tryCatch(read_sheet(SHEET_URL, sheet = sheet),
                    error = function(e) { read_err <<- conditionMessage(e); NULL })
    if (is.null(out) || nrow(out) == 0) empty else out
  }

  sessions   <- safe_read("sessions", EMPTY_SESSIONS)
  parameters <- safe_read("parameters", EMPTY_PARAMS)

  if (nrow(sessions) > 0) {
    sessions <- sessions %>%
      mutate(
        recordedAt     = suppressWarnings(as_datetime(recordedAt)),
        receivedAt     = suppressWarnings(as_datetime(receivedAt)),
        deviationIndex = suppressWarnings(as.numeric(deviationIndex)),
        across(any_of(names(DOMAIN_COLS)), ~ suppressWarnings(as.numeric(.)))
      )
  }

  if (nrow(parameters) > 0) {
    parameters <- parameters %>%
      mutate(
        recordedAt  = suppressWarnings(as_datetime(recordedAt)),
        value       = suppressWarnings(as.numeric(value)),
        z           = suppressWarnings(as.numeric(z)),
        provisional = suppressWarnings(as.integer(provisional)),
        flag        = factor(flag, levels = names(FLAG_COLS))
      )
  }

  # Always join so `joined` carries the parameter columns even when empty.
  joined <- parameters %>%
    left_join(
      sessions %>% select(sessionId, deviationIndex, languageName, sex, age),
      by = "sessionId"
    )

  list(sessions = sessions, parameters = parameters, joined = joined,
       error = read_err)
}

# ==========================================================================
# UI
# ==========================================================================
ui <- page_navbar(
  title = "SMILE Speech Signal",
  theme = bs_theme(version = 5, bootswatch = "flatly", primary = "#0ea5e9"),

  header = tagList(
    div(style = "padding:8px 14px;background:#fff7ed;border-bottom:1px solid #fed7aa;font-size:13px;color:#7c2d12",
        strong("Not a diagnostic tool. "),
        "These are acoustic measurements and their distance from published reference distributions, not a diagnosis, probability or grade.")
  ),

  sidebar = sidebar(
    width = 300,
    actionButton("refresh", "Reload from Google Sheet", class = "btn-primary btn-sm"),
    textOutput("lastLoaded"),
    uiOutput("loadStatus"),
    hr(),
    selectizeInput("participants", "Participants",
                   choices = NULL, multiple = TRUE,
                   options = list(placeholder = "All participants")),
    selectInput("language", "Language", choices = c("All"), selected = "All"),
    dateRangeInput("dates", "Date range", start = NULL, end = NULL),
    hr(),
    helpText("Data reads live from the Google Sheet. Filters apply to every tab.")
  ),

  # ---- Overview ----
  nav_panel(
    "Overview",
    layout_columns(
      fill = FALSE,
      value_box("Sessions", textOutput("kpiSessions"), showcase = bsicons::bs_icon("collection")),
      value_box("Participants", textOutput("kpiParticipants"), showcase = bsicons::bs_icon("people")),
      value_box("Median deviation index", textOutput("kpiMedianDev"), showcase = bsicons::bs_icon("speedometer2")),
      value_box("Flagged parameters", textOutput("kpiFlagged"), showcase = bsicons::bs_icon("flag"))
    ),
    layout_columns(
      col_widths = c(7, 5),
      card(card_header("Deviation index over time"), plotlyOutput("devTime", height = 340)),
      card(card_header("Distribution of deviation index"), plotlyOutput("devHist", height = 340))
    ),
    layout_columns(
      col_widths = c(6, 6),
      card(card_header("Average domain scores"), plotlyOutput("domainBar", height = 320)),
      card(card_header("Flag status across all parameters"), plotlyOutput("flagBar", height = 320))
    )
  ),

  # ---- Parameter profile ----
  nav_panel(
    "Parameter profile",
    layout_sidebar(
      sidebar = sidebar(
        selectInput("profileParticipant", "Participant", choices = NULL),
        selectInput("profileSession", "Session", choices = NULL),
        position = "right", width = 260
      ),
      card(
        card_header("Per-parameter deviation (z-scores) for the selected session"),
        plotlyOutput("profilePlot", height = 620)
      )
    )
  ),

  # ---- Parameter trends ----
  nav_panel(
    "Parameter trends",
    layout_sidebar(
      sidebar = sidebar(
        selectInput("trendParameter", "Parameter", choices = NULL),
        radioButtons("trendY", "Show", c("Raw value" = "value", "z-score" = "z")),
        position = "right", width = 260
      ),
      card(
        card_header(textOutput("trendTitle")),
        plotlyOutput("trendPlot", height = 480)
      )
    )
  ),

  # ---- Domains over time ----
  nav_panel(
    "Domain trends",
    card(
      card_header("Domain scores over time (0-100, higher = closer to typical)"),
      plotlyOutput("domainTime", height = 520)
    )
  ),

  # ---- Data tables ----
  nav_panel(
    "Data",
    navset_card_tab(
      nav_panel("Sessions", DTOutput("tblSessions")),
      nav_panel("Parameters (long)", DTOutput("tblParameters"))
    )
  )
)

# ==========================================================================
# SERVER
# ==========================================================================
server <- function(input, output, session) {

  raw <- reactiveVal(load_data())
  loadedAt <- reactiveVal(Sys.time())

  observeEvent(input$refresh, {
    raw(load_data())
    loadedAt(Sys.time())
  })

  output$lastLoaded <- renderText({
    paste("Loaded", format(loadedAt(), "%Y-%m-%d %H:%M:%S"))
  })

  output$loadStatus <- renderUI({
    d <- raw()
    if (!is.null(d$error)) {
      div(style = "margin-top:8px;padding:8px;border:1px solid #ef4444;border-radius:6px;background:#fef2f2;color:#7f1d1d;font-size:12px",
          strong("Could not read the sheet:"), br(), d$error, br(), br(),
          "If this mentions auth/permission, share the sheet as ",
          strong("Anyone with the link (Viewer)"), " or switch to gs4_auth().")
    } else {
      div(style = "margin-top:8px;font-size:12px;color:#166534",
          sprintf("Read OK: %d sessions, %d parameter rows.",
                  nrow(d$sessions), nrow(d$parameters)))
    }
  })

  # populate filter controls when data changes
  observe({
    d <- raw()
    ppl  <- if (nrow(d$sessions)) sort(unique(d$sessions$participant)) else character(0)
    lang <- if (nrow(d$sessions)) sort(unique(d$sessions$languageName)) else character(0)
    prm  <- if (nrow(d$parameters)) sort(unique(d$parameters$label)) else character(0)

    updateSelectizeInput(session, "participants", choices = ppl, server = TRUE)
    updateSelectInput(session, "language", choices = c("All", lang), selected = "All")
    updateSelectInput(session, "profileParticipant", choices = ppl)
    updateSelectInput(session, "trendParameter", choices = prm)

    if (nrow(d$sessions)) {
      rng <- range(as.Date(d$sessions$recordedAt), na.rm = TRUE)
      if (all(is.finite(rng)))
        updateDateRangeInput(session, "dates", start = rng[1], end = rng[2])
    }
  })

  # ---- filtered reactives --------------------------------------------------
  fsessions <- reactive({
    d <- raw()$sessions
    if (!nrow(d)) return(d)
    if (length(input$participants)) d <- d %>% filter(participant %in% input$participants)
    if (!is.null(input$language) && input$language != "All")
      d <- d %>% filter(languageName == input$language)
    if (!is.null(input$dates))
      d <- d %>% filter(as.Date(recordedAt) >= input$dates[1],
                        as.Date(recordedAt) <= input$dates[2])
    d
  })

  fparams <- reactive({
    d <- raw()$joined
    if (!nrow(d)) return(d)
    keep <- fsessions()$sessionId
    d %>% filter(sessionId %in% keep)
  })

  # ---- KPIs ---------------------------------------------------------------
  output$kpiSessions     <- renderText({ as.character(nrow(fsessions())) })
  output$kpiParticipants <- renderText({ as.character(dplyr::n_distinct(fsessions()$participant)) })
  output$kpiMedianDev    <- renderText({
    d <- fsessions(); if (!nrow(d)) return("-")
    as.character(round(median(d$deviationIndex, na.rm = TRUE)))
  })
  output$kpiFlagged <- renderText({
    d <- fparams(); if (!nrow(d)) return("-")
    as.character(sum(d$flag %in% c("watch", "out"), na.rm = TRUE))
  })

  # ---- Overview charts ----------------------------------------------------
  output$devTime <- renderPlotly({
    d <- fsessions(); validate(need(nrow(d) > 0, "No sessions match the filters."))
    p <- ggplot(d, aes(recordedAt, deviationIndex, colour = participant,
                       group = participant,
                       text = paste0(participant, "<br>", format(recordedAt, "%Y-%m-%d %H:%M"),
                                     "<br>Deviation ", round(deviationIndex)))) +
      geom_line(alpha = .7) + geom_point(size = 2.5) +
      scale_y_continuous(limits = c(0, 100)) +
      labs(x = NULL, y = "Deviation index") +
      theme_minimal(base_size = 13)
    ggplotly(p, tooltip = "text")
  })

  output$devHist <- renderPlotly({
    d <- fsessions(); validate(need(nrow(d) > 0, "No sessions match the filters."))
    p <- ggplot(d, aes(deviationIndex)) +
      geom_histogram(binwidth = 5, fill = "#0ea5e9", colour = "white") +
      geom_vline(xintercept = c(25, 50), linetype = "dashed", colour = "#64748b") +
      labs(x = "Deviation index", y = "Sessions") +
      theme_minimal(base_size = 13)
    ggplotly(p)
  })

  output$domainBar <- renderPlotly({
    d <- fsessions(); validate(need(nrow(d) > 0, "No sessions match the filters."))
    dm <- d %>%
      summarise(across(any_of(names(DOMAIN_COLS)), ~ mean(., na.rm = TRUE))) %>%
      pivot_longer(everything(), names_to = "domain", values_to = "score") %>%
      mutate(domain = DOMAIN_COLS[domain])
    p <- ggplot(dm, aes(reorder(domain, score), score,
                        text = paste0(domain, "<br>Mean ", round(score)))) +
      geom_col(fill = "#0ea5e9") + coord_flip() +
      scale_y_continuous(limits = c(0, 100)) +
      labs(x = NULL, y = "Mean domain score") +
      theme_minimal(base_size = 13)
    ggplotly(p, tooltip = "text")
  })

  output$flagBar <- renderPlotly({
    d <- fparams(); validate(need(nrow(d) > 0, "No parameters match the filters."))
    fb <- d %>% filter(!is.na(flag)) %>% count(flag)
    p <- ggplot(fb, aes(flag, n, fill = flag,
                        text = paste0(FLAG_LABS[as.character(flag)], "<br>", n, " parameters"))) +
      geom_col() +
      scale_fill_manual(values = FLAG_COLS, guide = "none") +
      scale_x_discrete(labels = FLAG_LABS) +
      labs(x = NULL, y = "Count") +
      theme_minimal(base_size = 13)
    ggplotly(p, tooltip = "text")
  })

  # ---- Parameter profile --------------------------------------------------
  observe({
    d <- fsessions()
    updateSelectInput(session, "profileParticipant",
                      choices = if (nrow(d)) sort(unique(d$participant)) else character(0))
  })
  observeEvent(input$profileParticipant, {
    d <- fsessions()
    req(nrow(d) > 0, "participant" %in% names(d),
        !is.null(input$profileParticipant), nzchar(input$profileParticipant))
    d <- d %>% filter(participant == input$profileParticipant)
    if (!nrow(d)) return()
    labs <- setNames(d$sessionId, format(d$recordedAt, "%Y-%m-%d %H:%M"))
    updateSelectInput(session, "profileSession", choices = labs,
                      selected = d$sessionId[which.max(d$recordedAt)])
  }, ignoreInit = TRUE)

  output$profilePlot <- renderPlotly({
    d <- fparams()
    validate(need(!is.null(input$profileSession) && nrow(d) > 0,
                  "Pick a participant and session."))
    sel <- d %>% filter(sessionId == input$profileSession)
    validate(need(nrow(sel) > 0, "No parameters for that session."))
    p <- ggplot(sel, aes(reorder(label, z), z, fill = flag,
                        text = paste0(label, "<br>value ", round(value, 3),
                                      " ", unit, "<br>z ", round(z, 2),
                                      "<br>", FLAG_LABS[as.character(flag)]))) +
      geom_col() + coord_flip() +
      geom_hline(yintercept = c(-2, 2), linetype = "dashed", colour = "#94a3b8") +
      scale_fill_manual(values = FLAG_COLS, labels = FLAG_LABS, name = NULL) +
      labs(x = NULL, y = "z  (±2 = edge of reference range)") +
      theme_minimal(base_size = 12)
    ggplotly(p, tooltip = "text")
  })

  # ---- Parameter trends ---------------------------------------------------
  output$trendTitle <- renderText({
    if (is.null(input$trendParameter)) "Parameter over time" else
      paste(input$trendParameter, "over time")
  })
  output$trendPlot <- renderPlotly({
    d <- fparams()
    validate(need(!is.null(input$trendParameter) && nrow(d) > 0,
                  "No data for the current filters."))
    sel <- d %>% filter(label == input$trendParameter)
    validate(need(nrow(sel) > 0, "That parameter has no rows yet."))
    yvar <- input$trendY
    ylab <- if (yvar == "value") paste0("Value (", unique(sel$unit)[1], ")") else "z-score"
    p <- ggplot(sel, aes(recordedAt, .data[[yvar]], colour = participant,
                        group = participant,
                        text = paste0(participant, "<br>", format(recordedAt, "%Y-%m-%d %H:%M"),
                                      "<br>", round(.data[[yvar]], 3)))) +
      geom_line(alpha = .7) + geom_point(size = 2.5) +
      labs(x = NULL, y = ylab) +
      theme_minimal(base_size = 13)
    if (yvar == "z") p <- p + geom_hline(yintercept = c(-2, 2),
                                          linetype = "dashed", colour = "#94a3b8")
    ggplotly(p, tooltip = "text")
  })

  # ---- Domain trends ------------------------------------------------------
  output$domainTime <- renderPlotly({
    d <- fsessions(); validate(need(nrow(d) > 0, "No sessions match the filters."))
    dm <- d %>%
      select(participant, recordedAt, any_of(names(DOMAIN_COLS))) %>%
      pivot_longer(any_of(names(DOMAIN_COLS)), names_to = "domain", values_to = "score") %>%
      mutate(domain = DOMAIN_COLS[domain])
    p <- ggplot(dm, aes(recordedAt, score, colour = domain, group = domain,
                        text = paste0(domain, "<br>", format(recordedAt, "%Y-%m-%d"),
                                      "<br>", round(score)))) +
      geom_line(alpha = .8) + geom_point(size = 2) +
      facet_wrap(~ participant) +
      scale_y_continuous(limits = c(0, 100)) +
      labs(x = NULL, y = "Domain score", colour = NULL) +
      theme_minimal(base_size = 12)
    ggplotly(p, tooltip = "text")
  })

  # ---- Data tables --------------------------------------------------------
  output$tblSessions   <- renderDT({ datatable(fsessions(), options = list(scrollX = TRUE, pageLength = 15)) })
  output$tblParameters <- renderDT({ datatable(fparams(),   options = list(scrollX = TRUE, pageLength = 25)) })
}

shinyApp(ui, server)
