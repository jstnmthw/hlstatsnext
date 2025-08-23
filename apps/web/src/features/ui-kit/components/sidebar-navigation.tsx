"use client"

import { cn } from "@repo/ui"
import { useEffect, useState } from "react"

interface TableOfContentsItem {
  id: string
  title: string
  subsections: Array<{ id: string; title: string }>
}

interface SidebarNavigationProps {
  tableOfContents: TableOfContentsItem[]
}

export function SidebarNavigation({ tableOfContents }: SidebarNavigationProps) {
  const [activeSection, setActiveSection] = useState("")

  // Handle smooth scrolling
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 120 // Account for header height (88px) + extra spacing
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
    }
  }

  // Track active section on scroll - only track parent sections
  useEffect(() => {
    const handleScroll = () => {
      const viewportOffset = 120 // Offset from top of viewport
      let currentActiveParent = ""

      // Get all sections (parent + subsections) with their parent mapping
      const allSections = tableOfContents.flatMap((section) => [
        { id: section.id, parentId: section.id },
        ...section.subsections.map((sub) => ({ id: sub.id, parentId: section.id })),
      ])

      // Find which section is currently in the viewport
      for (const { id, parentId } of allSections) {
        const element = document.getElementById(id)
        if (element) {
          const rect = element.getBoundingClientRect()
          // If this section is at the top of viewport, mark its parent as active
          if (rect.top <= viewportOffset && rect.bottom > viewportOffset) {
            currentActiveParent = parentId
            break
          }
          // If we've scrolled past this section, it might still be the active parent
          if (rect.top <= viewportOffset) {
            currentActiveParent = parentId
          }
        }
      }

      if (currentActiveParent) {
        setActiveSection(currentActiveParent)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll() // Call once to set initial state

    return () => window.removeEventListener("scroll", handleScroll)
  }, [tableOfContents])

  return (
    <aside className="fixed left-0 top-17 h-[calc(100vh-68px)] w-64 overflow-y-auto border-r border-border bg-background p-6">
      <nav className="space-y-6">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Table of Contents</h2>
          <ul className="space-y-3">
            {tableOfContents.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "block w-full cursor-pointer text-left text-sm font-medium transition-all duration-200 rounded-md px-2 py-1 hover:text-white hover:bg-white/10",
                    activeSection === section.id
                      ? "text-white bg-white/15 font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {section.title}
                </button>
                {section.subsections.length > 0 && (
                  <ul className="mt-2 ml-4 space-y-2">
                    {section.subsections.map((subsection) => (
                      <li key={subsection.id}>
                        <button
                          onClick={() => scrollToSection(subsection.id)}
                          className="block w-full cursor-pointer text-left text-sm transition-all duration-200 rounded-md px-2 py-1 text-muted-foreground hover:text-white hover:bg-white/10"
                        >
                          {subsection.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  )
}
