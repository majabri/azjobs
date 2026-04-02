/**
 * Application Service — API layer.
 */
export { loadApplications, updateApplicationStatus, deleteApplication, setFollowUp, markFollowedUp } from "./service";
export type { JobApplication, Offer } from "./types";
