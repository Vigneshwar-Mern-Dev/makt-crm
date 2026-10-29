"use server";

import { updateAgentAvailabilityAction as _updateAction } from "@/app/lib/lead-distribution";
import type { AvailabilityStatus } from "@/app/lib/lead-distribution";

export async function updateAvailabilityAction(status: AvailabilityStatus) {
  return _updateAction(status);
}
