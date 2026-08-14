import { EventEmitter } from "node:events";

class RegistrationStatusEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow high number of concurrent listeners during major events
    this.setMaxListeners(5000);
  }

  /**
   * Emits a registration status update event.
   *
   * @param {string} registrationId
   * @param {Object} data - Updated registration details
   */
  emitStatusUpdate(registrationId, data) {
    if (!registrationId) return;
    this.emit(`registration:${String(registrationId)}`, data);
  }

  /**
   * Subscribes a listener to status updates for a specific registration.
   *
   * @param {string} registrationId
   * @param {(data: Object) => void} callback
   */
  subscribe(registrationId, callback) {
    const eventName = `registration:${String(registrationId)}`;
    this.on(eventName, callback);
    return () => this.off(eventName, callback);
  }
}

export const statusEmitter = new RegistrationStatusEmitter();
export default statusEmitter;
