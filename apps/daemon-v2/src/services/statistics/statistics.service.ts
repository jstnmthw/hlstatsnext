/*
  StatisticsService
  -----------------
  Responsible for aggregating and calculating statistics from stored game
  events. In Phase 1 it exposes an empty interface; implementations will follow
  after persistence layer is connected.
*/

export interface IStatisticsService {
  recalculateAll(): Promise<void>;
  recalculatePlayer(playerId: string): Promise<void>;
}

export class StatisticsService implements IStatisticsService {
  async recalculateAll(): Promise<void> {
    // TODO: Aggregate all stats across players, servers, etc.
  }

  async recalculatePlayer(playerId: string): Promise<void> {
    // TODO: Recompute stats for a single player
    void playerId;
  }
}
