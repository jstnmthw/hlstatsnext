/*
  RconService
  -----------
  Handles Remote Console (RCON) interactions with game servers for issuing
  commands or retrieving live information. Actual RCON protocol handling will
  be added in a later phase.
*/

export interface IRconService {
  connect(host: string, port: number, password: string): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand(command: string): Promise<string>; // returns server response
  executeCommand(serverId: number, command: string): Promise<string>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class RconService implements IRconService {
  async connect(host: string, port: number, password: string): Promise<void> {
    // TODO: Implement proper RCON client connection
    void host;
    void port;
    void password;
  }

  async disconnect(): Promise<void> {
    // TODO: Close RCON connection
  }

  async sendCommand(command: string): Promise<string> {
    // TODO: Actually send command and return response
    void command;
    return "";
  }

  async executeCommand(serverId: number, command: string): Promise<string> {
    void serverId; // placeholder to avoid unused param lint
    void command; // placeholder to avoid unused param lint

    return "Command executed successfully";
  }

  async start(): Promise<void> {
    console.log("🔧 RCON Service started");
  }

  async stop(): Promise<void> {
    console.log("🛑 RCON Service stopped");
  }
}
