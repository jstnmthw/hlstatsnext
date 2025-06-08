import { getClient } from "@/lib/apollo-client";
import { graphql } from "@/lib/gql";

const GET_GAMES_QUERY = graphql(`
  query GetGames {
    findManyGame {
      code
      name
    }
  }
`);

export async function GameList() {
  const { data } = await getClient().query({ query: GET_GAMES_QUERY });

  return (
    <div>
      <h1>Games</h1>
      <ul>
        {data.findManyGame.map((game) => (
          <li key={game.code}>{game.name}</li>
        ))}
      </ul>
    </div>
  );
}
