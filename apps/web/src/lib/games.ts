export interface GameOption {
  code: string
  name: string
}

export type GameListItem = {
  code: string
  name: string
  hidden: string
  realgame: string
  __typename?: string
}

export interface PublicGame {
  code: string
  name: string
  realgame: string
}
