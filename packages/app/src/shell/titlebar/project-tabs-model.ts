import type { SessionInfo } from "@opencode/client/promise"
import { displayName } from "@/shell/layout/helpers"
import type { Tab } from "@/shell/tabs/tabs"
import { pathKey } from "@/workspaces/path-key"
import { isProjectDirectory } from "@/workspaces/paths"

export type ProjectTabProject = {
  id?: string
  name?: string
  worktree: string
  sandboxes?: readonly string[]
}

export type ProjectTabMetadata = {
  session?: Pick<SessionInfo, "projectID" | "location">
  directory?: string
  project?: ProjectTabProject
}

export type ProjectTabGroup = {
  key: string
  server: Tab["server"]
  projectID?: string
  directory?: string
  title: string
  tabs: Tab[]
}

export function groupProjectTabs(
  tabs: readonly Tab[],
  input: {
    fallbackTitle: string
    resolve: (tab: Tab) => ProjectTabMetadata | undefined
  },
) {
  const groups = new Map<string, ProjectTabGroup>()
  tabs.forEach((tab) => {
    const metadata = input.resolve(tab)
    const directory =
      metadata?.session?.location.directory ??
      metadata?.directory ??
      (tab.type === "draft" ? (tab.worktree ?? tab.directory) : undefined)
    const project = metadata?.project
    const projectID = project?.id ?? metadata?.session?.projectID
    // Non-repository directories share the server's "global" project ID.
    const identity =
      projectID && projectID !== "global"
        ? `project:${projectID}`
        : directory
          ? `directory:${pathKey(project?.worktree ?? directory)}`
          : `tab:${tab.type === "session" ? tab.sessionId : tab.draftID}`
    const key = `${tab.server}\0${identity}`
    const existing = groups.get(key)
    if (existing) {
      existing.tabs.push(tab)
      return
    }
    groups.set(key, {
      key,
      server: tab.server,
      projectID,
      directory,
      title: project ? displayName(project) : directory ? displayName({ worktree: directory }) : input.fallbackTitle,
      tabs: [tab],
    })
  })
  return [...groups.values()]
}

export function projectForDirectory<T extends ProjectTabProject>(directory: string, projects: readonly T[]) {
  const key = pathKey(directory)
  return (
    projects.find((project) => pathKey(project.worktree) === key) ??
    projects.find((project) => project.sandboxes?.some((sandbox) => pathKey(sandbox) === key)) ??
    projects
      .filter((project) => isProjectDirectory(project, directory))
      .toSorted((a, b) => b.worktree.length - a.worktree.length)[0]
  )
}

export function mergeProjectTabOrder(all: readonly string[], group: readonly string[], next: readonly string[]) {
  const groupKeys = new Set(group)
  const reordered = [...next]
  let index = 0
  return all.map((key) => (groupKeys.has(key) ? (reordered[index++] ?? key) : key))
}
