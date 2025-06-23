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
}
