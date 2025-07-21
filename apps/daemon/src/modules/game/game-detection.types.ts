export interface GameDetectionResult {
  gameCode: string
  confidence: number
  detection_method: string
}

export interface IGameDetectionService {
  detectGameFromLogContent(logLines: string[]): GameDetectionResult
  detectGameFromServerQuery(address: string, port: number): Promise<GameDetectionResult>
  detectGame(address: string, port: number, logLines: string[]): Promise<GameDetectionResult>
  normalizeGameCode(detectedCode: string): string
}
