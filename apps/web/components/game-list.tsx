import { query } from "@/lib/apollo-client"
import { graphql } from "@/lib/gql"

const GET_GAMES_QUERY = graphql(`
  query GetGamesList {
    findManyGame(where: { hidden: { equals: "0" } }) {
      code
      name
      hidden
    }
  }
`)

export async function GameList() {
  const { data } = await query({ query: GET_GAMES_QUERY })

  return (
    <div>
      <h1>Games</h1>
      <ul>
        {data.findManyGame.map((game) => (
          <li key={game.code}>
            {game.name} {game.hidden === "0" ? "visible" : "hidden"}
          </li>
        ))}
      </ul>
    </div>
  )
}
