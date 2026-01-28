import type { AxiomRequest } from "next-axiom";

// Util function for error logging requests
export function logError(error: any, request?: AxiomRequest) {
  console.error(error);
  request?.log.error(error);
}
