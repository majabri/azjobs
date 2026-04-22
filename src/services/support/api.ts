/**
 * Support Service — API layer.
 */
export { createTicket, getUserTickets, getFaqs, getTicketMessages, addTicketMessage } from "./service";
export type { TicketMessage } from "./service";
export type {
  SupportTicket,
  CreateTicketPayload,
  FaqEntry,
  RequestType,
  Priority,
  TicketStatus,
} from "./types";
export {
  REQUEST_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "./types";
