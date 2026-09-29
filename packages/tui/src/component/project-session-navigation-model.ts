import path from "node:path"
import type { SessionInfo } from "@opencode/client"
import { projectName } from "../util/project"

export type SessionProjectGroup = {
  projectID: string
  title: string
  sessions: SessionInfo[]
}

export function groupSessions(
  sessions: readonly SessionInfo[],
  getProject: (projectID: string) => { canonical: string; name?: string } | undefined,
): SessionProjectGroup[] {
  return Array.from(
    sessions.toSorted((a, b) => b.time.created - a.time.created).reduce((groups, session) => {
      const group = groups.get(session.projectID) ?? {
        projectID: session.projectID,
        title:
          projectName(getProject(session.projectID), session.location.directory) ??
          (path.basename(session.location.directory) || session.projectID),
        sessions: [],
      }
      group.sessions.push(session)
      groups.set(session.projectID, group)
      return groups
    }, new Map<string, SessionProjectGroup>()).values(),
  )
}

export function mergeSessions(remote: readonly SessionInfo[], local: readonly SessionInfo[]) {
  const sessions = new Map(remote.map((session) => [session.id, session]))
  local.forEach((session) => sessions.set(session.id, session))
  return Array.from(sessions.values()).filter((session) => !session.parentID)
}

export function paginateSessions(sessions: readonly SessionInfo[], visible: number) {
  return sessions.slice(0, Math.max(0, visible))
}
