import { gql } from "@apollo/client"

export const GET_SERVER_PLAYERS = gql`
  query GetServerPlayers(
    $serverId: Int!
    $filters: GetServerPlayersFiltersInput
    $take: Int
    $skip: Int
    $sortField: String
    $sortOrder: String
  ) {
    getServerPlayers(
      serverId: $serverId
      filters: $filters
      take: $take
      skip: $skip
      sortField: $sortField
      sortOrder: $sortOrder
    ) {
      players {
        playerId
        lastName
        skill
        kills
        deaths
        suicides
        headshots
        connectionTime
        lastEvent
        lastSkillChange
        activity
        country
        flag
        kdRatio
        headshotRatio
        isOnline
        sessionDuration
        totalSessions
        favoriteServer
        rank
        accuracyPercentage
      }
      totalCount
      onlineCount
      recentCount
    }
  }
`

export const GET_SERVER_DETAILS_WITH_PLAYERS = gql`
  query GetServerDetailsWithPlayers($serverId: Int!) {
    findUniqueServer(where: { serverId: $serverId }) {
      serverId
      name
      address
      port
      game
      publicAddress
      activePlayers
      maxPlayers
      activeMap
      lastEvent
      city
      country
      topPlayers(limit: 5) {
        playerId
        lastName
        skill
        kills
        deaths
        kdRatio
        isOnline
        rank
      }
      recentPlayers(limit: 5) {
        playerId
        lastName
        skill
        lastEvent
        isOnline
        sessionDuration
      }
    }
  }
`

export const GET_SERVER_BASIC_INFO = gql`
  query GetServerBasicInfo($serverId: Int!) {
    findUniqueServer(where: { serverId: $serverId }) {
      serverId
      name
      address
      port
      game
      publicAddress
      activePlayers
      maxPlayers
      activeMap
      lastEvent
      city
      country
    }
  }
`

export const GET_PLAYER_SERVER_HISTORY = gql`
  query GetPlayerServerHistory($playerId: Int!, $serverId: Int!, $limit: Int) {
    getPlayerServerHistory(playerId: $playerId, serverId: $serverId, limit: $limit) {
      id
      eventTime
      ipAddress
      hostname
      hostgroup
      eventTimeDisconnect
      map
      server {
        name
        address
        port
      }
    }
  }
`

export const GET_SERVER_PLAYER_COUNT = gql`
  query GetServerPlayerCount($serverId: Int!, $filters: GetServerPlayersFiltersInput) {
    getServerPlayers(serverId: $serverId, filters: $filters, take: 0, skip: 0) {
      totalCount
      onlineCount
      recentCount
    }
  }
`
