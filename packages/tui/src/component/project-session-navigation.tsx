import { For, Show, createMemo } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useData } from "../context/data"
import { useSessionTabs } from "../context/session-tabs"
import { useTheme } from "../context/theme"
import { useStorage } from "../context/storage"
import { withTimestampedFallback } from "@opencode/util/session-title-fallback"
import { Locale } from "../util/locale"
import { groupSessions, paginateSessions } from "./project-session-navigation-model"

const HORIZONTAL_PAGE = 10
const VERTICAL_PAGE = 5

type NavigationProps = {
  orientation: "horizontal" | "vertical"
  width?: number
}

export function ProjectTabs() {
  const data = useData()
  const tabs = useSessionTabs()
  const theme = useTheme()
  const allSessions = createMemo(() => openSessions(tabs, data))
  const groups = createMemo(() => groupSessions(allSessions(), (projectID) => data.project.get(projectID)))
  const currentProject = createMemo(() => {
    const sessionID = tabs.current()
    return allSessions().find((session) => session.id === sessionID)?.projectID
  })

  return (
    <box flexDirection="row" height={1} flexShrink={0} gap={2} paddingLeft={1} paddingRight={1}>
      <For each={groups()}>
        {(group) => {
          const active = () => group.projectID === currentProject()
          return (
            <box
              flexShrink={0}
              backgroundColor={active() ? theme.background.action.primary.selected : undefined}
              paddingLeft={1}
              paddingRight={1}
              onMouseUp={(event) => {
                if (event.button === 1) {
                  const current = group.sessions.find((session) => session.id === tabs.current())
                  if (current) tabs.close(current.id)
                  return
                }
                if (event.button !== 0) return
                const session = group.sessions.find((item) => item.id === tabs.current()) ?? group.sessions[0]
                if (session) {
                  tabs.open(session.id)
                  tabs.select(session.id)
                }
              }}
            >
              <text
                fg={active() ? theme.text.base : theme.text.muted}
                attributes={active() ? TextAttributes.BOLD : undefined}
                selectable={false}
              >
                {group.title}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}

export function ProjectSessionNavigation(props: NavigationProps) {
  const data = useData()
  const tabs = useSessionTabs()
  const theme = useTheme()
  const storage = useStorage()
  const [navigation, updateNavigation] = storage.store<NavigationState>("project-session-navigation", {
    initial: { expanded: {}, visible: {} },
  })
  const allSessions = createMemo(() => openSessions(tabs, data))
  const groups = createMemo(() => groupSessions(allSessions(), (projectID) => data.project.get(projectID)))
  const currentProject = createMemo(() => {
    const sessionID = tabs.current()
    return allSessions().find((session) => session.id === sessionID)?.projectID
  })
  const page = () => (props.orientation === "horizontal" ? HORIZONTAL_PAGE : VERTICAL_PAGE)
  const visibleGroups = createMemo(() => {
    if (props.orientation === "vertical") return groups()
    const current = currentProject()
    return current ? groups().filter((group) => group.projectID === current) : groups().slice(0, 1)
  })

  return (
    <scrollbox
      width={props.width}
      flexGrow={props.width === undefined ? 1 : 0}
      minHeight={0}
      scrollbarOptions={{ visible: false }}
      backgroundColor={theme.background.raised.base}
    >
      <box flexDirection="column" gap={1} padding={1}>
        <For each={visibleGroups()}>
          {(group) => {
            const isCurrent = () => group.projectID === currentProject()
            const isExpanded = () => navigation.expanded[group.projectID] ?? isCurrent()
            const navigationKey = `${props.orientation}:${group.projectID}`
            const count = () => navigation.visible[navigationKey] ?? page()
            const shown = () => paginateSessions(group.sessions, count())
            return (
              <box flexDirection="column">
                <box
                  flexDirection="row"
                  onMouseUp={(event) => {
                    if (event.button !== 0 || props.orientation !== "vertical") return
                    void updateNavigation((state) => {
                      state.expanded[group.projectID] = !isExpanded()
                    })
                  }}
                >
                  <text fg={theme.text.base} attributes={TextAttributes.BOLD} selectable={false}>
                    {isExpanded() ? "v" : ">"} {group.title}
                  </text>
                </box>
                <Show when={isExpanded()}>
                  <box flexDirection="column" paddingLeft={2} gap={1}>
                    <For each={shown()}>
                      {(session) => {
                        const active = () => session.id === tabs.current()
                        return (
                          <box
                            backgroundColor={active() ? theme.background.action.primary.selected : undefined}
                            onMouseUp={(event) => {
                              if (event.button === 1) {
                                tabs.close(session.id)
                                return
                              }
                              if (event.button !== 0) return
                              tabs.open(session.id)
                              tabs.select(session.id)
                            }}
                          >
                              <box flexGrow={1} minWidth={0}>
                                <text
                                  fg={active() ? theme.text.base : theme.text.muted}
                                  attributes={active() ? TextAttributes.BOLD : undefined}
                                  selectable={false}
                                >
                                  {sessionStatus(session.id, tabs)} {withTimestampedFallback(session)}
                                </text>
                              </box>
                              <box
                                width={2}
                                flexShrink={0}
                                onMouseUp={(event) => {
                                  if (event.button !== 0) return
                                  event.stopPropagation()
                                  tabs.close(session.id)
                                }}
                              >
                                <text fg={theme.text.muted} selectable={false}>
                                  ×
                                </text>
                              </box>
                          </box>
                        )
                      }}
                    </For>
                    <Show when={count() < group.sessions.length}>
                      <box
                        onMouseUp={(event) => {
                          if (event.button !== 0) return
                          void updateNavigation((state) => {
                            state.visible[navigationKey] = count() + page()
                          })
                        }}
                      >
                        <text fg={theme.text.action.primary.base} selectable={false}>
                          {Locale.sessionNavigation.more}
                        </text>
                      </box>
                    </Show>
                  </box>
                </Show>
              </box>
            )
          }}
        </For>
        <Show when={groups().length === 0}>
          <text fg={theme.text.muted} selectable={false}>{Locale.sessionNavigation.empty}</text>
        </Show>
      </box>
    </scrollbox>
  )
}

type NavigationState = {
  expanded: Record<string, boolean>
  visible: Record<string, number>
}

function openSessions(tabs: ReturnType<typeof useSessionTabs>, data: ReturnType<typeof useData>) {
  return tabs.tabs().flatMap((tab) => {
    const session = data.session.get(tab.sessionID)
    return session && !session.parentID ? [session] : []
  })
}

function sessionStatus(sessionID: string, tabs: ReturnType<typeof useSessionTabs>) {
  const status = tabs.status(sessionID)
  if (status.attention === "permission") return "!"
  if (status.attention === "question") return "?"
  if (status.busy) return "◌"
  if (status.unread === "error") return "×"
  if (status.unread) return "•"
  return " "
}
