/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query GetPublicGames {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      realgame\n    }\n  }\n": typeof types.GetPublicGamesDocument,
    "\n  query GetGames {\n    findManyGame {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n": typeof types.GetGamesDocument,
    "\n  query GetGamesWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [GameOrderByWithRelationInput!]\n    $where: GameWhereInput\n  ) {\n    findManyGame(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n": typeof types.GetGamesWithPaginationDocument,
    "\n  query GetGameCount($where: GameWhereInput) {\n    countGame(where: $where)\n  }\n": typeof types.GetGameCountDocument,
    "\n  query GetPlayers {\n    findManyPlayer {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      lastEvent\n      lastSkillChange\n    }\n  }\n": typeof types.GetPlayersDocument,
    "\n  query GetPlayersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [PlayerOrderByWithRelationInput!]\n    $where: PlayerWhereInput\n  ) {\n    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      country\n      flag\n      lastEvent\n      lastSkillChange\n    }\n  }\n": typeof types.GetPlayersWithPaginationDocument,
    "\n  query GetPlayerCount($where: PlayerWhereInput) {\n    countPlayer(where: $where)\n  }\n": typeof types.GetPlayerCountDocument,
    "\n  query GetGamesForSelect {\n    findManyGame {\n      code\n      name\n    }\n  }\n": typeof types.GetGamesForSelectDocument,
    "\n  query GetModsForSelect {\n    findManyModSupported {\n      code\n      name\n    }\n  }\n": typeof types.GetModsForSelectDocument,
    "\n  mutation CreateServerWithConfig($data: CreateServerInput!) {\n    createServerWithConfig(data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n": typeof types.CreateServerWithConfigDocument,
    "\n  mutation UpdateServerWithConfig($serverId: Int!, $data: UpdateServerInput!) {\n    updateServerWithConfig(serverId: $serverId, data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n": typeof types.UpdateServerWithConfigDocument,
    "\n  query GetServers {\n    findManyServer {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n": typeof types.GetServersDocument,
    "\n  query GetServersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [ServerOrderByWithRelationInput!]\n    $where: ServerWhereInput\n  ) {\n    findManyServer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n": typeof types.GetServersWithPaginationDocument,
    "\n  query GetServerCount($where: ServerWhereInput) {\n    countServer(where: $where)\n  }\n": typeof types.GetServerCountDocument,
    "\n  query GetServerByIdWithConfigs($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n      configs {\n        parameter\n        value\n      }\n    }\n  }\n": typeof types.GetServerByIdWithConfigsDocument,
    "\n  mutation CreateServerToken($input: CreateServerTokenInput!) {\n    createServerToken(input: $input) {\n      success\n      message\n      rawToken\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n": typeof types.CreateServerTokenDocument,
    "\n  mutation RevokeServerToken($input: RevokeServerTokenInput!) {\n    revokeServerToken(input: $input) {\n      success\n      message\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n": typeof types.RevokeServerTokenDocument,
    "\n  query GetServerTokens($includeRevoked: Boolean, $take: Int, $skip: Int) {\n    findManyServerToken(includeRevoked: $includeRevoked, take: $take, skip: $skip) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n": typeof types.GetServerTokensDocument,
    "\n  query GetServerTokenCount($includeRevoked: Boolean) {\n    countServerToken(includeRevoked: $includeRevoked)\n  }\n": typeof types.GetServerTokenCountDocument,
    "\n  query GetServerTokenById($id: Int!) {\n    findServerToken(id: $id) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n": typeof types.GetServerTokenByIdDocument,
    "\n  query GetUsers {\n    findManyUser {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n": typeof types.GetUsersDocument,
    "\n  query GetUsersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [UserOrderByWithRelationInput!]\n    $where: UserWhereInput\n  ) {\n    findManyUser(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n": typeof types.GetUsersWithPaginationDocument,
    "\n  query GetUserCount($where: UserWhereInput) {\n    countUser(where: $where)\n  }\n": typeof types.GetUserCountDocument,
    "\n  query GetGamesList {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      hidden\n    }\n  }\n": typeof types.GetGamesListDocument,
    "\n  query GetGeneralStats {\n    countPlayer\n    countClan\n    countGame\n    countServer\n    findManyServer {\n      kills\n    }\n    findFirstEventFrag(orderBy: [{ eventTime: desc }]) {\n      eventTime\n    }\n    findUniqueOption(where: { keyname: \"DeleteDays\" }) {\n      value\n    }\n  }\n": typeof types.GetGeneralStatsDocument,
    "\n  query GetServerById($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n    }\n  }\n": typeof types.GetServerByIdDocument,
};
const documents: Documents = {
    "\n  query GetPublicGames {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      realgame\n    }\n  }\n": types.GetPublicGamesDocument,
    "\n  query GetGames {\n    findManyGame {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n": types.GetGamesDocument,
    "\n  query GetGamesWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [GameOrderByWithRelationInput!]\n    $where: GameWhereInput\n  ) {\n    findManyGame(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n": types.GetGamesWithPaginationDocument,
    "\n  query GetGameCount($where: GameWhereInput) {\n    countGame(where: $where)\n  }\n": types.GetGameCountDocument,
    "\n  query GetPlayers {\n    findManyPlayer {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      lastEvent\n      lastSkillChange\n    }\n  }\n": types.GetPlayersDocument,
    "\n  query GetPlayersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [PlayerOrderByWithRelationInput!]\n    $where: PlayerWhereInput\n  ) {\n    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      country\n      flag\n      lastEvent\n      lastSkillChange\n    }\n  }\n": types.GetPlayersWithPaginationDocument,
    "\n  query GetPlayerCount($where: PlayerWhereInput) {\n    countPlayer(where: $where)\n  }\n": types.GetPlayerCountDocument,
    "\n  query GetGamesForSelect {\n    findManyGame {\n      code\n      name\n    }\n  }\n": types.GetGamesForSelectDocument,
    "\n  query GetModsForSelect {\n    findManyModSupported {\n      code\n      name\n    }\n  }\n": types.GetModsForSelectDocument,
    "\n  mutation CreateServerWithConfig($data: CreateServerInput!) {\n    createServerWithConfig(data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n": types.CreateServerWithConfigDocument,
    "\n  mutation UpdateServerWithConfig($serverId: Int!, $data: UpdateServerInput!) {\n    updateServerWithConfig(serverId: $serverId, data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n": types.UpdateServerWithConfigDocument,
    "\n  query GetServers {\n    findManyServer {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n": types.GetServersDocument,
    "\n  query GetServersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [ServerOrderByWithRelationInput!]\n    $where: ServerWhereInput\n  ) {\n    findManyServer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n": types.GetServersWithPaginationDocument,
    "\n  query GetServerCount($where: ServerWhereInput) {\n    countServer(where: $where)\n  }\n": types.GetServerCountDocument,
    "\n  query GetServerByIdWithConfigs($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n      configs {\n        parameter\n        value\n      }\n    }\n  }\n": types.GetServerByIdWithConfigsDocument,
    "\n  mutation CreateServerToken($input: CreateServerTokenInput!) {\n    createServerToken(input: $input) {\n      success\n      message\n      rawToken\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n": types.CreateServerTokenDocument,
    "\n  mutation RevokeServerToken($input: RevokeServerTokenInput!) {\n    revokeServerToken(input: $input) {\n      success\n      message\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n": types.RevokeServerTokenDocument,
    "\n  query GetServerTokens($includeRevoked: Boolean, $take: Int, $skip: Int) {\n    findManyServerToken(includeRevoked: $includeRevoked, take: $take, skip: $skip) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n": types.GetServerTokensDocument,
    "\n  query GetServerTokenCount($includeRevoked: Boolean) {\n    countServerToken(includeRevoked: $includeRevoked)\n  }\n": types.GetServerTokenCountDocument,
    "\n  query GetServerTokenById($id: Int!) {\n    findServerToken(id: $id) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n": types.GetServerTokenByIdDocument,
    "\n  query GetUsers {\n    findManyUser {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n": types.GetUsersDocument,
    "\n  query GetUsersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [UserOrderByWithRelationInput!]\n    $where: UserWhereInput\n  ) {\n    findManyUser(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n": types.GetUsersWithPaginationDocument,
    "\n  query GetUserCount($where: UserWhereInput) {\n    countUser(where: $where)\n  }\n": types.GetUserCountDocument,
    "\n  query GetGamesList {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      hidden\n    }\n  }\n": types.GetGamesListDocument,
    "\n  query GetGeneralStats {\n    countPlayer\n    countClan\n    countGame\n    countServer\n    findManyServer {\n      kills\n    }\n    findFirstEventFrag(orderBy: [{ eventTime: desc }]) {\n      eventTime\n    }\n    findUniqueOption(where: { keyname: \"DeleteDays\" }) {\n      value\n    }\n  }\n": types.GetGeneralStatsDocument,
    "\n  query GetServerById($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n    }\n  }\n": types.GetServerByIdDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPublicGames {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      realgame\n    }\n  }\n"): (typeof documents)["\n  query GetPublicGames {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      realgame\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetGames {\n    findManyGame {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n"): (typeof documents)["\n  query GetGames {\n    findManyGame {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetGamesWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [GameOrderByWithRelationInput!]\n    $where: GameWhereInput\n  ) {\n    findManyGame(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n"): (typeof documents)["\n  query GetGamesWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [GameOrderByWithRelationInput!]\n    $where: GameWhereInput\n  ) {\n    findManyGame(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      code\n      name\n      hidden\n      realgame\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetGameCount($where: GameWhereInput) {\n    countGame(where: $where)\n  }\n"): (typeof documents)["\n  query GetGameCount($where: GameWhereInput) {\n    countGame(where: $where)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPlayers {\n    findManyPlayer {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      lastEvent\n      lastSkillChange\n    }\n  }\n"): (typeof documents)["\n  query GetPlayers {\n    findManyPlayer {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      lastEvent\n      lastSkillChange\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPlayersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [PlayerOrderByWithRelationInput!]\n    $where: PlayerWhereInput\n  ) {\n    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      country\n      flag\n      lastEvent\n      lastSkillChange\n    }\n  }\n"): (typeof documents)["\n  query GetPlayersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [PlayerOrderByWithRelationInput!]\n    $where: PlayerWhereInput\n  ) {\n    findManyPlayer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      playerId\n      lastName\n      email\n      skill\n      kills\n      deaths\n      country\n      flag\n      lastEvent\n      lastSkillChange\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetPlayerCount($where: PlayerWhereInput) {\n    countPlayer(where: $where)\n  }\n"): (typeof documents)["\n  query GetPlayerCount($where: PlayerWhereInput) {\n    countPlayer(where: $where)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetGamesForSelect {\n    findManyGame {\n      code\n      name\n    }\n  }\n"): (typeof documents)["\n  query GetGamesForSelect {\n    findManyGame {\n      code\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetModsForSelect {\n    findManyModSupported {\n      code\n      name\n    }\n  }\n"): (typeof documents)["\n  query GetModsForSelect {\n    findManyModSupported {\n      code\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateServerWithConfig($data: CreateServerInput!) {\n    createServerWithConfig(data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateServerWithConfig($data: CreateServerInput!) {\n    createServerWithConfig(data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateServerWithConfig($serverId: Int!, $data: UpdateServerInput!) {\n    updateServerWithConfig(serverId: $serverId, data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateServerWithConfig($serverId: Int!, $data: UpdateServerInput!) {\n    updateServerWithConfig(serverId: $serverId, data: $data) {\n      success\n      message\n      configsCount\n      server {\n        serverId\n        name\n        address\n        port\n        game\n        publicAddress\n        statusUrl\n        connectionType\n        dockerHost\n        sortOrder\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServers {\n    findManyServer {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n"): (typeof documents)["\n  query GetServers {\n    findManyServer {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [ServerOrderByWithRelationInput!]\n    $where: ServerWhereInput\n  ) {\n    findManyServer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n"): (typeof documents)["\n  query GetServersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [ServerOrderByWithRelationInput!]\n    $where: ServerWhereInput\n  ) {\n    findManyServer(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      serverId\n      name\n      address\n      port\n      game\n      activePlayers\n      maxPlayers\n      activeMap\n      lastEvent\n      city\n      country\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServerCount($where: ServerWhereInput) {\n    countServer(where: $where)\n  }\n"): (typeof documents)["\n  query GetServerCount($where: ServerWhereInput) {\n    countServer(where: $where)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServerByIdWithConfigs($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n      configs {\n        parameter\n        value\n      }\n    }\n  }\n"): (typeof documents)["\n  query GetServerByIdWithConfigs($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n      configs {\n        parameter\n        value\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateServerToken($input: CreateServerTokenInput!) {\n    createServerToken(input: $input) {\n      success\n      message\n      rawToken\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateServerToken($input: CreateServerTokenInput!) {\n    createServerToken(input: $input) {\n      success\n      message\n      rawToken\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RevokeServerToken($input: RevokeServerTokenInput!) {\n    revokeServerToken(input: $input) {\n      success\n      message\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n"): (typeof documents)["\n  mutation RevokeServerToken($input: RevokeServerTokenInput!) {\n    revokeServerToken(input: $input) {\n      success\n      message\n      token {\n        id\n        tokenPrefix\n        name\n        game\n        createdAt\n        expiresAt\n        revokedAt\n        lastUsedAt\n        createdBy\n        serverCount\n        status\n        hasRconPassword\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServerTokens($includeRevoked: Boolean, $take: Int, $skip: Int) {\n    findManyServerToken(includeRevoked: $includeRevoked, take: $take, skip: $skip) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n"): (typeof documents)["\n  query GetServerTokens($includeRevoked: Boolean, $take: Int, $skip: Int) {\n    findManyServerToken(includeRevoked: $includeRevoked, take: $take, skip: $skip) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServerTokenCount($includeRevoked: Boolean) {\n    countServerToken(includeRevoked: $includeRevoked)\n  }\n"): (typeof documents)["\n  query GetServerTokenCount($includeRevoked: Boolean) {\n    countServerToken(includeRevoked: $includeRevoked)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServerTokenById($id: Int!) {\n    findServerToken(id: $id) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n"): (typeof documents)["\n  query GetServerTokenById($id: Int!) {\n    findServerToken(id: $id) {\n      id\n      tokenPrefix\n      name\n      game\n      createdAt\n      expiresAt\n      revokedAt\n      lastUsedAt\n      createdBy\n      serverCount\n      status\n      hasRconPassword\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetUsers {\n    findManyUser {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n"): (typeof documents)["\n  query GetUsers {\n    findManyUser {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetUsersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [UserOrderByWithRelationInput!]\n    $where: UserWhereInput\n  ) {\n    findManyUser(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n"): (typeof documents)["\n  query GetUsersWithPagination(\n    $take: Int\n    $skip: Int\n    $orderBy: [UserOrderByWithRelationInput!]\n    $where: UserWhereInput\n  ) {\n    findManyUser(take: $take, skip: $skip, orderBy: $orderBy, where: $where) {\n      id\n      name\n      email\n      emailVerified\n      role\n      banned\n      banReason\n      banExpires\n      image\n      createdAt\n      updatedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetUserCount($where: UserWhereInput) {\n    countUser(where: $where)\n  }\n"): (typeof documents)["\n  query GetUserCount($where: UserWhereInput) {\n    countUser(where: $where)\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetGamesList {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      hidden\n    }\n  }\n"): (typeof documents)["\n  query GetGamesList {\n    findManyGame(where: { hidden: { equals: \"0\" } }) {\n      code\n      name\n      hidden\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetGeneralStats {\n    countPlayer\n    countClan\n    countGame\n    countServer\n    findManyServer {\n      kills\n    }\n    findFirstEventFrag(orderBy: [{ eventTime: desc }]) {\n      eventTime\n    }\n    findUniqueOption(where: { keyname: \"DeleteDays\" }) {\n      value\n    }\n  }\n"): (typeof documents)["\n  query GetGeneralStats {\n    countPlayer\n    countClan\n    countGame\n    countServer\n    findManyServer {\n      kills\n    }\n    findFirstEventFrag(orderBy: [{ eventTime: desc }]) {\n      eventTime\n    }\n    findUniqueOption(where: { keyname: \"DeleteDays\" }) {\n      value\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query GetServerById($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n    }\n  }\n"): (typeof documents)["\n  query GetServerById($serverId: Int!) {\n    findUniqueServer(where: { serverId: $serverId }) {\n      serverId\n      name\n      address\n      port\n      game\n      publicAddress\n      statusUrl\n      rconPassword\n      connectionType\n      dockerHost\n      sortOrder\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;