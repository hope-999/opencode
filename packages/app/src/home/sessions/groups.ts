import { compareSessionTime } from "@/shell/layout/helpers"
import type { HomeSessionRecord } from "./records"

export type HomeSessionGroup = {
  id: string
  projectID: string
  title: string
  project: HomeSessionRecord["project"]
  sessions: HomeSessionRecord[]
}

export function groupSessionsByProject(records: readonly HomeSessionRecord[]): HomeSessionGroup[] {
  const groups = new Map<string, HomeSessionGroup>()

  for (const record of records.toSorted((a, b) => compareSessionTime(a.session, b.session))) {
    const projectID = record.session.projectID
    const group = groups.get(projectID)
    if (group) {
      group.sessions.push(record)
      continue
    }

    groups.set(projectID, {
      id: `project:${projectID}`,
      projectID,
      title: record.projectName,
      project: record.project,
      sessions: [record],
    })
  }

  return [...groups.values()]
}
