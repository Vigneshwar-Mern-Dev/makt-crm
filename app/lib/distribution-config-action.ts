"use server";

import {
  updateLeadDistributionConfigAction as _updateConfig,
} from "@/app/lib/lead-distribution";
import type { DistributionMode } from "@/app/lib/lead-distribution";

export async function saveDistributionConfigAction(data: {
  enabled: boolean;
  mode: DistributionMode;
  slaMinutes: number;
  autoReassign: boolean;
}) {
  return _updateConfig(data);
}
