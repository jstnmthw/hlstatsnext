/**
 * Game Detector Adapter
 *
 * Thin wrapper adapter for the game detection service.
 */
import type {
  GameDetectionResult,
  IGameDetectionService,
} from "@/modules/game/game-detection.types"
import type { IGameDetector } from "../ingress.dependencies"

/**
 * Game detector adapter
 */
export class GameDetectorAdapter implements IGameDetector {
  constructor(private readonly gameDetectionService: IGameDetectionService) {}

  async detectGame(
    address: string,
    port: number,
    logSamples: string[],
  ): Promise<GameDetectionResult> {
    return this.gameDetectionService.detectGame(address, port, logSamples)
  }
}
