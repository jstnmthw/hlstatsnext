import { Header } from "@/features/common/components/header"
import { Footer } from "@/features/common/components/footer"
import { MainContent } from "@/features/common/components/main-content"
import { PageWrapper } from "@/features/common/components/page-wrapper"
import { activeServers } from "@/lib/mock"
import { cn } from "@repo/ui/lib/utils"

export const metadata = {
  title: "Welcome to " + process.env.NEXT_PUBLIC_APP_NAME,
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION,
}

export default function Page() {
  return (
    <PageWrapper>
      <Header fixed />
      <MainContent fixedHeader>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border rounded-lg">
            <h2 className="uppercase tracking-tight text-xs font-bold p-2 border-b border-border">
              Game Servers
            </h2>
            <ul>
              {activeServers.map((server) => (
                <li key={server.id} className="border-b border-border py-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mx-3",
                          server.status === "online" ? "bg-emerald-500" : "bg-red-500/50",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">{server.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {server.map} {server.players}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-1 border rounded-lg p-2">Sidebar</div>
        </div>
      </MainContent>
      <Footer />
    </PageWrapper>
  )
}
