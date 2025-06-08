import { BarChart3, Users, Server, Trophy } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { cn } from "@repo/ui/lib/utils";

const navigation = [
  { name: "Games", href: "/", icon: BarChart3 },
  { name: "Players", href: "/players", icon: Users },
  { name: "Servers", href: "/servers", icon: Server },
  { name: "Rankings", href: "/rankings", icon: Trophy },
];

export async function Header() {
  const pathname = (await headers()).get("next-url") ?? "/";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <BarChart3 className="h-6 w-6 text-blue-500" />
              <span className="text-zinc-100 font-semibold text-base">
                HLStats<span className="text-lime-400">Next</span>
              </span>
            </Link>

            <nav className="hidden md:flex space-x-6">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-1 px-3 py-2 rounded-md text-sm transition-colors",
                      pathname === item.href
                        ? "text-zinc-100 bg-zinc-800"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
