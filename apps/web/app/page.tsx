import { GameList } from "@/components/game-list";

export default function Page() {
  return (
    <main className="flex flex-col items-center justify-between min-h-screen p-24">
      <GameList />
    </main>
  );
}
