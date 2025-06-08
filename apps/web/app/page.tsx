import { Header } from "@/components/layout/header";
import { GameList } from "@/components/game-list";

export default function Page() {
  return (
    <>
      <Header />
      <main className="flex flex-col items-center justify-between min-h-screen p-24">
        <GameList />
      </main>
    </>
  );
}
