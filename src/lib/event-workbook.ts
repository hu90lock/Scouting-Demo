import { workbookToBytes } from "@office-kit/xlsx/io"
import { makeBarChart, makeBarSeries, makeChartSpace } from "@office-kit/xlsx/chart"
import { addChartAt } from "@office-kit/xlsx/drawing"
import { createWorkbook, addWorksheet } from "@office-kit/xlsx/workbook"
import { makeAlignment, makeFont, makePatternFill, registerCellStyle } from "@office-kit/xlsx/styles"
import { makeAutoFilter, setAutoFilter, setColumnWidths, setFreezePanes, setCell } from "@office-kit/xlsx/worksheet"
import type { CellValue } from "@office-kit/xlsx/cell"

export type EventWorkbookData = {
  event: Record<string, unknown> | null
  teams: Array<Record<string, unknown>>
  matches: Array<Record<string, unknown>>
  pitReports: Array<Record<string, unknown>>
  matchReports: Array<Record<string, unknown>>
  pickLists: Array<Record<string, unknown>>
  predictions: Array<Record<string, unknown>>
}

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export async function downloadEventWorkbook(data: EventWorkbookData, eventName: string, eventCode: string) {
  const bytes = await createEventWorkbook(data, eventName, eventCode)
  const fileName = `${slug(eventName) || slug(eventCode) || "event"}-${slug(eventCode) || "scouting"}-report.xlsx`
  const url = URL.createObjectURL(new Blob([bytes], { type: MIME_XLSX }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createEventWorkbook(data: EventWorkbookData, eventName: string, eventCode: string) {
  const workbook = createWorkbook()
  workbook.properties = { title: `${eventName} Scouting Report`, subject: `Event scouting export for ${eventCode}` }
  const styles = createStyles(workbook)

  const teams = [...data.teams].sort((a, b) => numberValue(a.number) - numberValue(b.number))
  const matches = [...data.matches].sort((a, b) => numberValue(a.tournamentLevel) - numberValue(b.tournamentLevel) || numberValue(a.playNumber) - numberValue(b.playNumber))
  const pitReports = [...data.pitReports].sort((a, b) => numberValue(a.teamNumber) - numberValue(b.teamNumber))
  const matchReports = [...data.matchReports].sort((a, b) => numberValue(a.matchNumber) - numberValue(b.matchNumber) || numberValue(a.teamNumber) - numberValue(b.teamNumber))
  const teamByNumber = new Map(teams.map(team => [numberValue(team.number), team]))
  const matchByKey = new Map(matches.map(match => [stringValue(match.toaMatchKey), match]))
  const competingTeams = teams.filter(team => team.competing !== false)
  const pitScouted = new Set(pitReports.map(report => numberValue(report.teamNumber)))
  const pitScoutedCount = competingTeams.filter(team => pitScouted.has(numberValue(team.number))).length
  const pendingPitCount = Math.max(0, competingTeams.length - pitScoutedCount)
  const average = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
  const avgDriver = average(matchReports.map(report => numberValue(report.driverRating)))
  const avgDefense = average(matchReports.map(report => numberValue(report.defenseRating)))
  const avgAutoPoints = average(matchReports.map(report => numberValue(report.autoHiveTips)))
  const avgTeleopPoints = average(matchReports.map(report => numberValue(report.teleopFlowers)))

  const overview = addWorksheet(workbook, "Overview")
  writeOverview({
    overview, styles, event: data.event, eventName, eventCode,
    teamCount: teams.length, competingCount: competingTeams.length, matchCount: matches.length,
    pitReportCount: pitReports.length, matchReportCount: matchReports.length,
    pickListCount: data.pickLists.length, predictionCount: data.predictions.length,
    pitScoutedCount, pendingPitCount,
    avgDriver, avgDefense, avgAutoPoints, avgTeleopPoints,
  })

  writeTableSheet(workbook, styles, "Event", "Event details", "Regional information and import status.", ["Field", "Details"], eventRows(data.event, eventCode, eventName))
  writeTableSheet(workbook, styles, "Teams", "Team roster", "One row per event team. Ratings and averages are the Convex event summaries.", ["Team number", "Team name", "City", "State / region", "Competing", "Pit report", "Pick tier", "Driver rating", "Auto points avg.", "Teleop points avg.", "Tags"], teams.map(team => [
    numberValue(team.number), stringValue(team.name), stringValue(team.city), stringValue(team.state),
    team.competing === false ? "No" : "Yes", pitScouted.has(numberValue(team.number)) ? "Complete" : "Needed",
    stringValue(team.tier, "Uncategorized"), numberValue(team.driver), numberValue(team.auto), numberValue(team.teleop),
    stringValue(Array.isArray(team.tags) ? team.tags.join(" · ") : ""),
  ]), [0, 7, 8, 9])
  writeTableSheet(workbook, styles, "Matches", "Match schedule", "Alliance rosters, schedule and posted scores from the event.", ["Match", "Level code", "Play number", "Scheduled time", "Red alliance", "Blue alliance", "Red score", "Blue score", "Result"], matches.map(match => {
    const redScore = optionalNumber(match.redScore)
    const blueScore = optionalNumber(match.blueScore)
    const outcome = redScore === undefined || blueScore === undefined ? "Not played" : redScore === blueScore ? "Tie" : redScore > blueScore ? "Red wins" : "Blue wins"
    return [
      stringValue(match.matchName), numberValue(match.tournamentLevel), numberValue(match.playNumber), stringValue(match.scheduledTime, "Time not published"),
      allianceText(match.redTeamNumbers, teamByNumber), allianceText(match.blueTeamNumbers, teamByNumber),
      redScore ?? "", blueScore ?? "", outcome,
    ]
  }), [1, 2, 6, 7])
  writeTableSheet(workbook, styles, "Pit Reports", "Pit scouting reports", "Robot hardware and capabilities reported by scouts.", ["Team number", "Team name", "Drivetrain", "Frame width (in)", "Frame length (in)", "Motor type", "Motors", "Servos", "Intake type", "Capabilities", "Submitted", "Scout account ID"], pitReports.map(report => [
    numberValue(report.teamNumber), teamName(teamByNumber, report.teamNumber), stringValue(report.driveTrain),
    optionalNumber(report.frameWidth) ?? "", optionalNumber(report.frameLength) ?? "", stringValue(report.motorType),
    optionalNumber(report.totalMotors) ?? "", optionalNumber(report.totalServos) ?? "", stringValue(report.intakeType),
    stringValue(Array.isArray(report.capabilities) ? report.capabilities.join(" · ") : ""), dateValue(report.submittedAt), stringValue(report.scoutId),
  ]), [0, 3, 4, 6, 7])
  writeTableSheet(workbook, styles, "Match Reports", "Match scouting reports", "One row per submitted scout report; field sections follow the scouting form.", ["Match number", "Team number", "Team name", "Auto leave", "Auto hive tips", "Auto park", "Auto notes", "Teleop hive tips", "Teleop notes", "Endgame park", "Endgame flower points", "Endgame notes", "Driver rating", "Defense rating", "Tags", "Submitted", "Scout account ID"], matchReports.map(report => [
    numberValue(report.matchNumber), numberValue(report.teamNumber), teamName(teamByNumber, report.teamNumber),
    report.autoLeave ? "Yes" : "No", numberValue(report.autoHiveTips), report.autoPark ? "Park" : "No park", stringValue(report.autoNotes),
    numberValue(report.teleopHiveTips, numberValue(report.teleopFlowers)), stringValue(report.teleopNotes), report.endgamePark ? "Park" : "No park", numberValue(report.endgameFlowerPoints), stringValue(report.endgameNotes),
    numberValue(report.driverRating), numberValue(report.defenseRating), stringValue(Array.isArray(report.tags) ? report.tags.join(" · ") : ""),
    dateValue(report.submittedAt), stringValue(report.scoutId),
  ]), [0, 1, 4, 7, 10, 12, 13])
  writeTableSheet(workbook, styles, "My Pick Lists", "My pick lists", "Your private saved lists, expanded to one row per team assignment.", ["List", "Tier", "Team number", "Team name", "City"], data.pickLists.flatMap(list => {
    const tiers = isRecord(list.tiers) ? list.tiers : {}
    return Object.entries(tiers).flatMap(([tier, numbers]) => Array.isArray(numbers) ? numbers.map(teamNumber => {
      const team = teamByNumber.get(numberValue(teamNumber))
      return [stringValue(list.listName), tier, numberValue(teamNumber), team ? stringValue(team.name) : "Not on current roster", team ? stringValue(team.city) : ""]
    }) : [])
  }), [2])
  writeTableSheet(workbook, styles, "My Predictions", "My predictions", "Your private match picks, matched to the imported schedule where available.", ["Match", "Scheduled time", "Red alliance", "Blue alliance", "My pick", "Final result"], data.predictions.map(prediction => {
    const match = matchByKey.get(stringValue(prediction.matchKey))
    const redScore = optionalNumber(match?.redScore)
    const blueScore = optionalNumber(match?.blueScore)
    const result = redScore === undefined || blueScore === undefined ? "Not played" : redScore === blueScore ? "Tie" : redScore > blueScore ? "Red wins" : "Blue wins"
    const pick = prediction.pick === "red" ? "Red alliance" : prediction.pick === "blue" ? "Blue alliance" : prediction.pick === "tie" ? "Tie" : "Unknown"
    return [stringValue(match?.matchName, stringValue(prediction.matchKey)), stringValue(match?.scheduledTime, "Time not published"),
      match ? allianceText(match.redTeamNumbers, teamByNumber) : "Not on current schedule",
      match ? allianceText(match.blueTeamNumbers, teamByNumber) : "Not on current schedule", pick, result]
  }), [])

  return workbookToBytes(workbook)
}

type WorkbookStyles = ReturnType<typeof createStyles>

function createStyles(workbook: ReturnType<typeof createWorkbook>) {
  const font = (size: number, bold = false, color = "182536") => makeFont({ name: "Aptos", size, bold, color: rgb(color) })
  const navyFill = makePatternFill({ patternType: "solid", fgColor: rgb("182536") })
  const orangeFill = makePatternFill({ patternType: "solid", fgColor: rgb("FF694B") })
  const lightFill = makePatternFill({ patternType: "solid", fgColor: rgb("EEF2F6") })
  const paleOrangeFill = makePatternFill({ patternType: "solid", fgColor: rgb("FFF0EB") })
  return {
    title: registerCellStyle(workbook, { font: font(20, true, "FFFFFF"), fill: navyFill, alignment: makeAlignment({ vertical: "center" }) }),
    subtitle: registerCellStyle(workbook, { font: font(11, false, "536477") }),
    section: registerCellStyle(workbook, { font: font(12, true, "FFFFFF"), fill: orangeFill, alignment: makeAlignment({ vertical: "center" }) }),
    header: registerCellStyle(workbook, { font: font(10, true, "FFFFFF"), fill: navyFill, alignment: makeAlignment({ vertical: "center", wrapText: true }) }),
    body: registerCellStyle(workbook, { font: font(10), alignment: makeAlignment({ vertical: "center" }) }),
    bodyAlt: registerCellStyle(workbook, { font: font(10), fill: lightFill, alignment: makeAlignment({ vertical: "center" }) }),
    label: registerCellStyle(workbook, { font: font(10, true), fill: paleOrangeFill, alignment: makeAlignment({ vertical: "center" }) }),
    metric: registerCellStyle(workbook, { font: font(14, true, "182536"), alignment: makeAlignment({ vertical: "center", horizontal: "right" }), numberFormat: "#,##0.0" }),
    integer: registerCellStyle(workbook, { font: font(10), alignment: makeAlignment({ vertical: "center", horizontal: "right" }), numberFormat: "#,##0" }),
    decimal: registerCellStyle(workbook, { font: font(10), alignment: makeAlignment({ vertical: "center", horizontal: "right" }), numberFormat: "0.0" }),
    wrap: registerCellStyle(workbook, { font: font(10), alignment: makeAlignment({ vertical: "top", wrapText: true }) }),
    note: registerCellStyle(workbook, { font: font(9, false, "536477"), alignment: makeAlignment({ vertical: "top", wrapText: true }) }),
  }
}

function writeOverview(args: {
  overview: ReturnType<typeof addWorksheet>
  styles: WorkbookStyles
  event: Record<string, unknown> | null
  eventName: string
  eventCode: string
  teamCount: number
  competingCount: number
  matchCount: number
  pitReportCount: number
  matchReportCount: number
  pickListCount: number
  predictionCount: number
  pitScoutedCount: number
  pendingPitCount: number
  avgDriver: number
  avgDefense: number
  avgAutoPoints: number
  avgTeleopPoints: number
}) {
  const { overview: ws, styles } = args
  setColumnWidths(ws, [28, 17, 4, 25, 14, 4, 28, 17, 4], 1)
  setCell(ws, 1, 1, "SCOUTLINE  |  EVENT REPORT", styles.title)
  setCell(ws, 1, 2, "", styles.title)
  setCell(ws, 2, 1, `${args.event?.name ? stringValue(args.event.name) : args.eventName}  ·  ${args.eventCode}  ·  Exported ${new Date().toLocaleString()}`, styles.subtitle)

  setSection(ws, 4, 1, "EVENT SNAPSHOT", styles.section)
  setSection(ws, 4, 4, "PIT SCOUTING COVERAGE", styles.section)
  setSection(ws, 4, 7, "AVERAGE MATCH PERFORMANCE", styles.section)
  writeCellRows(ws, 5, 1, [["Measure", "Value"],
    ["Teams on roster", args.teamCount], ["Competing teams", args.competingCount], ["Scheduled matches", args.matchCount],
    ["Pit reports saved", args.pitReportCount], ["Match reports saved", args.matchReportCount],
    ["My pick lists", args.pickListCount], ["My predictions", args.predictionCount]], styles, { headerRow: true, numericColumns: [1] })
  writeCellRows(ws, 5, 4, [["Coverage status", "Teams"], ["Pit report saved", args.pitScoutedCount], ["Needs pit scouting", args.pendingPitCount]], styles, { headerRow: true, numericColumns: [1] })
  writeCellRows(ws, 5, 7, [["Measure", "Average"], ["Driver rating (1–10)", args.avgDriver], ["Defense rating (1–10)", args.avgDefense], ["Auto points / report", args.avgAutoPoints], ["Teleop points / report", args.avgTeleopPoints]], styles, { headerRow: true, numericColumns: [1] })

  setCell(ws, 11, 1, "Charts summarize the values shown in the tables above. They are native Excel charts and remain editable.", styles.note)
  addHorizontalChart(ws, "Pit scouting coverage", "D6", "E6", ["Pit report saved", "Needs pit scouting"], [args.pitScoutedCount, args.pendingPitCount], "A13", 620)
  addHorizontalChart(ws, "Average scoring points per report", "G8", "H8", ["Autonomous points", "Teleop points"], [args.avgAutoPoints, args.avgTeleopPoints], "G13", 620)
  addHorizontalChart(ws, "Average scout ratings (1–10)", "G6", "H6", ["Driver rating", "Defense rating"], [args.avgDriver, args.avgDefense], "A32", 620)

  setCell(ws, 52, 1, "HOW TO READ THIS REPORT", styles.section)
  setCell(ws, 53, 1, "Coverage", styles.label)
  setCell(ws, 53, 2, "Pit coverage counts competing teams with at least one saved pit report. Pending is the remaining competing roster.", styles.note)
  setCell(ws, 54, 1, "Averages", styles.label)
  setCell(ws, 54, 2, "Match averages use all saved reports for this event. Empty report sets display as 0.0; check the report count before interpreting averages.", styles.note)
  setCell(ws, 55, 1, "Private sheets", styles.label)
  setCell(ws, 55, 2, "My Pick Lists and My Predictions contain only the signed-in user's saved records.", styles.note)
}

function addHorizontalChart(ws: ReturnType<typeof addWorksheet>, title: string, categoryCol: string, valueCol: string, categories: string[], values: number[], anchor: string, widthPx: number) {
  const firstRow = Number(categoryCol.match(/\d+$/)?.[0] ?? 1)
  const lastRow = firstRow + categories.length - 1
  const categoryRef = `'Overview'!$${categoryCol.replace(/\d+$/, "")}$${firstRow}:$${categoryCol.replace(/\d+$/, "")}$${lastRow}`
  const valueRef = `'Overview'!$${valueCol.replace(/\d+$/, "")}$${firstRow}:$${valueCol.replace(/\d+$/, "")}$${lastRow}`
  const chart = makeBarChart({
    barDir: "bar",
    grouping: "clustered",
    gapWidth: 65,
    axIds: [101, 102],
    series: [makeBarSeries({ idx: 0, val: { ref: valueRef, cache: values }, cat: { ref: categoryRef, cache: categories, cacheKind: "str" } })],
  })
  const space = makeChartSpace({
    title,
    style: 10,
    legend: undefined,
    plotArea: {
      chart,
      catAx: { axId: 101, crossAx: 102, position: "l", scaling: { orientation: "maxMin" } },
      valAx: { axId: 102, crossAx: 101, position: "b", scaling: { min: 0 }, majorGridlines: true },
    },
  })
  addChartAt(ws, anchor, { space }, { widthPx, heightPx: 330 })
}

function setSection(ws: ReturnType<typeof addWorksheet>, row: number, column: number, value: string, styleId: number) {
  setCell(ws, row, column, value, styleId)
}

function writeCellRows(ws: ReturnType<typeof addWorksheet>, startRow: number, startColumn: number, rows: CellValue[][], styles: WorkbookStyles, options: { headerRow?: boolean; numericColumns?: number[] } = {}) {
  rows.forEach((row, index) => {
    const isHeader = options.headerRow && index === 0
    const dataIndex = isHeader ? 0 : index - (options.headerRow ? 1 : 0)
    row.forEach((value, col) => {
      const style = isHeader ? styles.header : value === "" ? styles.body : options.numericColumns?.includes(col) && typeof value === "number" ? (Number.isInteger(value) ? styles.integer : styles.decimal) : dataIndex % 2 ? styles.bodyAlt : styles.body
      setCell(ws, startRow + index, startColumn + col, value, style)
    })
  })
}

function writeTableSheet(workbook: ReturnType<typeof createWorkbook>, styles: WorkbookStyles, title: string, heading: string, description: string, headers: string[], rows: CellValue[][], numericColumns: number[] = []) {
  const ws = addWorksheet(workbook, title)
  setColumnWidths(ws, headers.map(header => Math.min(36, Math.max(13, header.length + 3))))
  setCell(ws, 1, 1, heading, styles.title)
  setCell(ws, 2, 1, description, styles.subtitle)
  headers.forEach((header, index) => setCell(ws, 4, index + 1, header, styles.header))
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    const numeric = numericColumns.includes(columnIndex) && typeof value === "number"
    const style = numeric ? Number.isInteger(value) ? styles.integer : styles.decimal : typeof value === "string" && value.length > 48 ? styles.wrap : rowIndex % 2 ? styles.bodyAlt : styles.body
    setCell(ws, rowIndex + 5, columnIndex + 1, value, style)
  }))
  const endColumn = columnName(headers.length)
  const endRow = Math.max(4, rows.length + 4)
  setAutoFilter(ws, makeAutoFilter({ ref: `A4:${endColumn}${endRow}` }))
  setFreezePanes(ws, { rows: 4, cols: 0 })
  return ws
}

function eventRows(event: Record<string, unknown> | null, eventCode: string, eventName: string): CellValue[][] {
  const details: Array<[string, CellValue]> = [
    ["Event name", event?.name ? stringValue(event.name) : eventName],
    ["Event code", event?.code ? stringValue(event.code) : eventCode],
    ["Season", stringValue(event?.seasonKey, "Not provided")],
    ["Location", [event?.city, event?.stateProv, event?.country].filter(Boolean).map(String).join(", ") || "Not provided"],
    ["Event start", stringValue(event?.startDate, "Not provided")],
    ["Event end", stringValue(event?.endDate, "Not provided")],
    ["Teams on roster", numberValue(event?.teamCount)],
    ["Competing teams", numberValue(event?.competingTeamCount)],
    ["Scheduled matches", numberValue(event?.matchCount)],
    ["Data source", event?.source === "orange-alliance" ? "The Orange Alliance" : event?.source === "demo" ? "Scoutline demo roster" : "Not provided"],
    ["Imported", dateValue(event?.importedAt) || "Not provided"],
  ]
  return details.map(([field, value]) => [field, value])
}

function allianceText(numbers: unknown, teamByNumber: Map<number, Record<string, unknown>>) {
  if (!Array.isArray(numbers) || numbers.length === 0) return "Alliance not published"
  return numbers.map(number => {
    const team = teamByNumber.get(numberValue(number))
    return team ? `${numberValue(number)} · ${stringValue(team.name)}` : String(number)
  }).join("  |  ")
}

function teamName(teamByNumber: Map<number, Record<string, unknown>>, teamNumber: unknown) {
  return stringValue(teamByNumber.get(numberValue(teamNumber))?.name, "Not on current roster")
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function dateValue(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  return new Date(value).toLocaleString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function columnName(number: number) {
  let name = ""
  for (let current = number; current > 0; current = Math.floor((current - 1) / 26)) name = String.fromCharCode(((current - 1) % 26) + 65) + name
  return name
}

function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase()
}

function rgb(value: string) {
  return { rgb: value.length === 6 ? `FF${value}` : value }
}
