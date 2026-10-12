export interface HealthResponse {
  status: 'ok';
  service: string;
}

export function healthResponse(service: string): HealthResponse {
  return { status: 'ok', service };
}
