/** Client-safe field definitions shared by the scouting forms and Convex saves. */
export const DRIVE_TRAIN_OPTIONS = ["Tank", "Omni / Mecanum", "Swerve", "Other"] as const
export const MOTOR_TYPE_OPTIONS = ["goBILDA (Yellow Jacket)", "AndyMark (NeverRest)", "REV Robotics", "Other"] as const
export const INTAKE_TYPE_OPTIONS = ["Bumper gap", "Slapdown", "4-Bar / 6-Bar", "Rack & Pinion"] as const
export const PIT_CAPABILITY_OPTIONS = ["Hive tips", "Pollen flower", "Nectar flower", "Can park", "Can leave", "Fast cycle speed"] as const

export type PitDriveTrain = (typeof DRIVE_TRAIN_OPTIONS)[number]
export type PitMotorType = (typeof MOTOR_TYPE_OPTIONS)[number]
export type PitIntakeType = (typeof INTAKE_TYPE_OPTIONS)[number]
export type PitCapability = (typeof PIT_CAPABILITY_OPTIONS)[number]

/** String values mirror the editable number inputs in the pit form. */
export type PitReportDraft = {
  driveTrain: PitDriveTrain
  frameWidth: string
  frameLength: string
  motorType: PitMotorType
  totalMotors: string
  totalServos: string
  intakeType: PitIntakeType
  capabilities: PitCapability[]
}

export type MatchReportDraft = {
  autoHiveTips: number
  autoLeave: boolean
  autoPark: boolean
  autoNotes: string
  teleopHiveTips: number
  teleopNotes: string
  endgamePark: boolean
  endgameFlowerPoints: number
  endgameNotes: string
  driverRating: number
  defenseRating: number
  tags: string[]
}

export const MATCH_SCOUT_TAGS = ["Fast", "Accurate", "Good driver", "Plays defense", "Tippy", "Broke down", "Inconsistent"] as const

/** Three numbered robot stations per alliance, matching TOA's match station model. */
export const MATCH_ROBOT_STATIONS = [
  { key: "red1", label: "Red 1", alliance: "red", index: 0 },
  { key: "red2", label: "Red 2", alliance: "red", index: 1 },
  { key: "red3", label: "Red 3", alliance: "red", index: 2 },
  { key: "blue1", label: "Blue 1", alliance: "blue", index: 0 },
  { key: "blue2", label: "Blue 2", alliance: "blue", index: 1 },
  { key: "blue3", label: "Blue 3", alliance: "blue", index: 2 },
] as const

export type MatchRobotStation = (typeof MATCH_ROBOT_STATIONS)[number]["key"]

export function robotStationsForSchedule(matches: Array<{ redTeamNumbers: readonly number[]; blueTeamNumbers: readonly number[] }>) {
  const largestAlliance = matches.reduce((largest, match) => Math.max(largest, match.redTeamNumbers.length, match.blueTeamNumbers.length), 0)
  const positionsPerAlliance = largestAlliance || 3
  return MATCH_ROBOT_STATIONS.filter(station => station.index < positionsPerAlliance)
}

export function teamAtRobotStation(station: MatchRobotStation, redTeamNumbers: number[], blueTeamNumbers: number[]): number | undefined {
  const definition = MATCH_ROBOT_STATIONS.find(item => item.key === station)
  if (!definition) return undefined
  return (definition.alliance === "red" ? redTeamNumbers : blueTeamNumbers)[definition.index]
}

export function createPitReportDraft(): PitReportDraft {
  return {
    driveTrain: "Omni / Mecanum",
    frameWidth: "18",
    frameLength: "18",
    motorType: "goBILDA (Yellow Jacket)",
    totalMotors: "4",
    totalServos: "3",
    intakeType: "4-Bar / 6-Bar",
    capabilities: ["Hive tips", "Can park"],
  }
}

export function createMatchReportDraft(): MatchReportDraft {
  return {
    autoHiveTips: 0,
    autoLeave: false,
    autoPark: false,
    autoNotes: "",
    teleopHiveTips: 0,
    teleopNotes: "",
    endgamePark: false,
    endgameFlowerPoints: 0,
    endgameNotes: "",
    driverRating: 5,
    defenseRating: 5,
    tags: [],
  }
}
