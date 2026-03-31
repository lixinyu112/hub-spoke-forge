export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export type HealthStatusDTO = {
  service: string;
  status: "ok";
  timestamp: string;
};
