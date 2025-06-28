import { UdpServer } from "../src/services/ingress/udp-server"
import { logger } from "../src/utils/logger"

async function main() {
  const port = 27500

  const udp = new UdpServer({ port })

  udp.on("logReceived", ({ logLine, serverAddress, serverPort }) => {
    logger.info(`[${serverAddress}:${serverPort}] ${logLine}`)
  })

  await udp.start()
  logger.ready(`UDP dump server is running on 0.0.0.0:${port}`)
}

main().catch((err: unknown) => {
  logger.failed("UDP dump server failed", err instanceof Error ? err.message : String(err))
  console.error(err)
})
