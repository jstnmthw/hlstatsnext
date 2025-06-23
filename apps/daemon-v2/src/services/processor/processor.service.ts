/*
  EventProcessorService
  ---------------------
  Consumes raw events from the ingress queue, validates them, and stores them
  using the database package. At this stage it only exposes an enqueue method.
*/

export interface IEventProcessor {
  enqueue(event: unknown): Promise<void>;
}

export class EventProcessorService implements IEventProcessor {
  async enqueue(event: unknown): Promise<void> {
    // TODO: Validate event structure and persist
    void event; // placeholder to avoid unused param lint
  }
}
