/**
 * HTTP Metrics Server
 *
 * Exposes Prometheus metrics via HTTP endpoint for scraping.
 * Provides health check and database query statistics endpoints.
 */

import http from "node:http"
import type { ILogger } from "../types"
import type { PrometheusMetricsExporter } from "./prometheus-metrics-exporter"

export interface MetricsServerOptions {
  port: number
  host?: string
  enableHealthCheck?: boolean
  enableQueryStats?: boolean
}

export class MetricsServer {
  private server: http.Server | null = null
  private readonly port: number
  private readonly host: string
  private readonly enableHealthCheck: boolean
  private readonly enableQueryStats: boolean

  constructor(
    private readonly metrics: PrometheusMetricsExporter,
    private readonly logger: ILogger,
    private readonly healthCheck?: () => Promise<{
      status: string
      database: boolean
      rabbitmq: boolean
      uptime: number
    }>,
    options: MetricsServerOptions = { port: 9091 },
  ) {
    this.port = options.port
    this.host = options.host || "0.0.0.0"
    this.enableHealthCheck = options.enableHealthCheck ?? true
    this.enableQueryStats = options.enableQueryStats ?? true
  }

  /**
   * Start the metrics HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res)
        })

        this.server.on("error", (error) => {
          this.logger.error("Metrics server error", { error: error.message })
          reject(error)
        })

        this.server.listen(this.port, this.host, () => {
          this.logger.info("Metrics server started", {
            port: this.port,
            host: this.host,
            endpoints: {
              metrics: `http://${this.host}:${this.port}/metrics`,
              health: this.enableHealthCheck
                ? `http://${this.host}:${this.port}/health`
                : "disabled",
              queryStats: this.enableQueryStats
                ? `http://${this.host}:${this.port}/query-stats`
                : "disabled",
            },
          })
          resolve()
        })
      } catch (error) {
        this.logger.error("Failed to start metrics server", {
          error: error instanceof Error ? error.message : String(error),
        })
        reject(error)
      }
    })
  }

  /**
   * Stop the metrics HTTP server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.logger.info("Metrics server stopped")
        this.server = null
        resolve()
      })
    })
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || "/"

    try {
      // Route requests
      if (url === "/metrics") {
        this.handleMetrics(req, res)
      } else if (url === "/health" && this.enableHealthCheck) {
        this.handleHealth(req, res)
      } else if (url === "/query-stats" && this.enableQueryStats) {
        this.handleQueryStats(req, res)
      } else if (url === "/") {
        this.handleRoot(req, res)
      } else {
        this.handleNotFound(req, res)
      }
    } catch (error) {
      this.handleError(req, res, error)
    }
  }

  /**
   * Handle /metrics endpoint (Prometheus scrape target)
   */
  private handleMetrics(req: http.IncomingMessage, res: http.ServerResponse): void {
    const metricsText = this.metrics.exportMetrics()

    res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Content-Length": Buffer.byteLength(metricsText),
    })
    res.end(metricsText)

    this.logger.debug("Metrics exported", {
      path: req.url || "/metrics",
      size: Buffer.byteLength(metricsText),
    })
  }

  /**
   * Handle /health endpoint
   */
  private async handleHealth(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const health = this.healthCheck
        ? await this.healthCheck()
        : {
            status: "healthy",
            database: true,
            rabbitmq: true,
            uptime: process.uptime(),
          }

      const statusCode = health.status === "healthy" ? 200 : 503
      const responseBody = JSON.stringify(
        {
          ...health,
          timestamp: new Date().toISOString(),
          version: process.env.APP_VERSION || "unknown",
          nodeVersion: process.version,
        },
        null,
        2,
      )

      res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(responseBody),
      })
      res.end(responseBody)
    } catch (error) {
      this.handleError(req, res, error)
    }
  }

  /**
   * Handle /query-stats endpoint (database query statistics)
   */
  private handleQueryStats(req: http.IncomingMessage, res: http.ServerResponse): void {
    const stats = this.metrics.getDatabaseQueryStats()
    const responseBody = JSON.stringify(stats, null, 2)

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(responseBody),
    })
    res.end(responseBody)

    this.logger.debug("Query stats served", { path: req.url })
  }

  /**
   * Handle / root endpoint (documentation)
   */
  private handleRoot(req: http.IncomingMessage, res: http.ServerResponse): void {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>HLStatsNext Metrics</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { margin: 10px 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .endpoint { background: #f5f5f5; padding: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>HLStatsNext Metrics Server</h1>
  <p>Available endpoints:</p>
  <ul>
    <li class="endpoint">
      <strong><a href="/metrics">/metrics</a></strong><br>
      Prometheus metrics in text format (for scraping)
    </li>
    ${
      this.enableHealthCheck
        ? `
    <li class="endpoint">
      <strong><a href="/health">/health</a></strong><br>
      Health check status (JSON)
    </li>
    `
        : ""
    }
    ${
      this.enableQueryStats
        ? `
    <li class="endpoint">
      <strong><a href="/query-stats">/query-stats</a></strong><br>
      Database query statistics (JSON)
    </li>
    `
        : ""
    }
  </ul>
  <p>
    <strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds<br>
    <strong>Node Version:</strong> ${process.version}
  </p>
</body>
</html>
    `

    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Length": Buffer.byteLength(html),
    })
    res.end(html)

    this.logger.debug("Root documentation served", { path: req.url })
  }

  /**
   * Handle 404 Not Found
   */
  private handleNotFound(req: http.IncomingMessage, res: http.ServerResponse): void {
    const responseBody = JSON.stringify({
      error: "Not Found",
      path: req.url,
      availableEndpoints: [
        "/",
        "/metrics",
        this.enableHealthCheck ? "/health" : null,
        this.enableQueryStats ? "/query-stats" : null,
      ].filter(Boolean),
    })

    res.writeHead(404, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(responseBody),
    })
    res.end(responseBody)
  }

  /**
   * Handle errors
   */
  private handleError(req: http.IncomingMessage, res: http.ServerResponse, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    this.logger.error("Metrics server request error", {
      path: req.url,
      error: errorMessage,
    })

    const responseBody = JSON.stringify({
      error: "Internal Server Error",
      message: errorMessage,
    })

    res.writeHead(500, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(responseBody),
    })
    res.end(responseBody)
  }
}
