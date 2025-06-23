/*
  IngressService
  --------------
  Listens for incoming UDP packets from game servers and forwards parsed events
  to the internal processing pipeline.
*/

import dgram from "dgram";

export interface IIngressService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class IngressService implements IIngressService {
  private server: dgram.Socket | null = null;

  constructor(private readonly port: number = 27500) {}

  async start(): Promise<void> {
    this.server = dgram.createSocket("udp4");
    // TODO: Add event listeners and error handling
    this.server.bind(this.port);
  }

  async stop(): Promise<void> {
    this.server?.close();
    this.server = null;
  }
}
