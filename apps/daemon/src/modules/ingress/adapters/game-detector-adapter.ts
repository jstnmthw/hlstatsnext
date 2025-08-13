/**
 * Game Detector Adapter
 *
 * Thin wrapper adapter for the game detection service.
 */
import type { IGameDetector } from "../ingress.dependencies"
import type {
  IGameDetectionService,
  GameDetectionResult,
} from "@/modules/game/game-detection.types"

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
