/**
 * EventBus
 * Central event system for game-wide communication
 * Allows decoupled communication between game systems
 */

import { Events } from "phaser";

/**
 * Global event bus for cross-system communication
 * Use this to emit and listen for game events
 *
 * @example
 * // Emit an event
 * EventBus.emit('patient:died', { patientId: 1 });
 *
 * // Listen for an event
 * EventBus.on('patient:died', (data) => {
 *     console.log('Patient died:', data.patientId);
 * });
 *
 * // Listen once
 * EventBus.once('game:over', (data) => {
 *     console.log('Game over!', data);
 * });
 *
 * // Remove listener
 * EventBus.off('patient:died', myHandler);
 */
export const EventBus = new Events.EventEmitter();

/**
 * Type-safe event emission helper
 * @param event Event name from EVENTS constant
 * @param data Event payload
 */
export function emit<T>(event: string, data?: T): void {
  EventBus.emit(event, data);
}

/**
 * Type-safe event listener helper
 * @param event Event name from EVENTS constant
 * @param callback Event handler
 * @param context Optional context for the callback
 */
export function on<T>(
  event: string,
  callback: (data: T) => void,
  context?: unknown
): void {
  EventBus.on(event, callback, context);
}

/**
 * Listen for an event only once
 * @param event Event name
 * @param callback Event handler
 * @param context Optional context for the callback
 */
export function once<T>(
  event: string,
  callback: (data: T) => void,
  context?: unknown
): void {
  EventBus.once(event, callback, context);
}

/**
 * Remove an event listener
 * @param event Event name
 * @param callback The original callback function
 * @param context Optional context that was used
 */
export function off(
  event: string,
  callback?: (...args: unknown[]) => void,
  context?: unknown
): void {
  EventBus.off(event, callback, context);
}

/**
 * Remove all listeners for an event
 * @param event Event name (optional - removes all if not provided)
 */
export function removeAllListeners(event?: string): void {
  EventBus.removeAllListeners(event);
}

// Export individual functions as well for convenience
export default EventBus;
