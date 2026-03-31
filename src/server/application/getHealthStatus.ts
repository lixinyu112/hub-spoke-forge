import { formatDateToIso } from "@/shared/lib/formatDate";
import type { ApiResponse, HealthStatusDTO } from "@/shared/types/api";

/**
 * Return service health payload for API and SSR usage.
 * @returns Typed health status response.
 */
export function getHealthStatus(): ApiResponse<HealthStatusDTO> {
  return {
    success: true,
    data: {
      service: "hub-spoke-forge",
      status: "ok",
      timestamp: formatDateToIso(new Date()),
    },
  };
}
