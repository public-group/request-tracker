/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { APP_CONFIG } from "../constants";

/**
 * Replicates the requestHelper_calculateCapacitySLA logic EXACTLY.
 */
export function calculateSLA(
  now: Date, 
  category: string, 
  priorityTier: number, 
  valuesCount: number, 
  requestType: string
): Date {
  let daysRequired;

  if (requestType === "Configurational") {
    daysRequired = 2;
  } else {
    const categoryCapacities = APP_CONFIG.CAPACITY_MAP[category];
    let dailyCapacity = 30;
    if (categoryCapacities && categoryCapacities[priorityTier]) {
      dailyCapacity = categoryCapacities[priorityTier];
    }
    daysRequired = Math.ceil(valuesCount / dailyCapacity) || 1; 
  }

  let deadline = new Date(now.getTime());
  const currentDay = deadline.getDay(); 
  
  let daysUntilNextMonday = (8 - currentDay) % 7;
  if (daysUntilNextMonday === 0) daysUntilNextMonday = 7; 
  deadline.setDate(deadline.getDate() + daysUntilNextMonday);
  deadline.setHours(12, 0, 0, 0); 

  const isHoliday = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return APP_CONFIG.HOLIDAYS.includes(`${y}-${m}-${d}`);
  };

  while (deadline.getDay() === 0 || deadline.getDay() === 6 || isHoliday(deadline)) {
    deadline.setDate(deadline.getDate() + 1);
  }

  let daysToAdd = daysRequired;
  while (daysToAdd > 0) {
    deadline.setDate(deadline.getDate() + 1);
    if (deadline.getDay() !== 0 && deadline.getDay() !== 6 && !isHoliday(deadline)) {
      daysToAdd--;
    }
  }
  return deadline;
}
