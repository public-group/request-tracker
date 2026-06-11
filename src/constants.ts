/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from "./types";

export const APP_CONFIG: Config = {
  OWNERS: { 
    'Home': 'Karagianni', 
    'Entertainment': 'Thomaidis', 
    'Technology': 'Pliagkou' 
  },
  REQUEST_TYPES: ["Major Issue", "UX Improvement", "Configurational", "Aesthetic Fix"],
  PRIORITY_MAP: { "Major Issue": 1, "UX Improvement": 2, "Configurational": 2, "Aesthetic Fix": 3 },
  
  // Holidays 2026 (from script)
  HOLIDAYS: [
    '2026-04-10', // Good Friday
    '2026-04-13', // Easter Monday
    '2026-05-01', // Labor Day
    '2026-06-01', // Holy Spirit Day
    '2026-10-28', // Ohi Day
    '2026-12-25'  // Christmas
  ],
  
  CAPACITY_MAP: {
    'IT': {1: 30, 2: 60, 3: 25},
    'Telephony': {1: 30, 2: 60, 3: 25},
    'Peripherals': {1: 30, 2: 60, 3: 25},
    'Gaming': {1: 45, 2: 90, 3: 25},
    'Gaming Merchandise': {1: 45, 2: 90, 3: 25},
    'TV & Sound': {1: 30, 2: 60, 3: 25},
    'Photo & E-Mobility': {1: 35, 2: 70, 3: 25},
    'Books': {1: 333, 2: 200, 3: 50},
    'Toys': {1: 100, 2: 60, 3: 50},
    'Stationery': {1: 100, 2: 60, 3: 50},
    'Music': {1: 166, 2: 100, 3: 50},
    'MDA': {1: 33, 2: 20, 3: 30},
    'SDA': {1: 50, 2: 30, 3: 30},

    'Fitness': {1: 50, 2: 30, 3: 30},
    'Personal Care': {1: 50, 2: 30, 3: 30},
    'Home Accessories': {1: 66, 2: 40, 3: 30}
  },
  SUBMITTERS_LIST: ['Tsatsani', 'Michailidis'],
  ROLES_LIST: ['owner', 'admin', 'Team Leader', 'Manager', 'Digital Merch'],
  ROLE_PERMISSIONS: {
    'owner': ['create_requests', 'update_qa_status', 'update_flow_status', 'view_admin_panel', 'admin_configurations'],
    'admin': ['create_requests', 'update_qa_status', 'update_flow_status', 'view_admin_panel', 'admin_configurations'],
    'Team Leader': ['update_flow_status'],
    'Manager': ['update_flow_status'],
    'Digital Merch': ['create_requests']
  }
};

export const DIVISION_CATEGORIES: Record<string, string[]> = {
  'Home': ['MDA', 'SDA', 'Fitness', 'Personal Care', 'Home Accessories'],
  'Entertainment': ['Books', 'Toys', 'Stationery', 'Music', 'Gaming Merchandise'], 
  'Technology': ['IT', 'Telephony', 'Peripherals', 'Gaming', 'TV & Sound', 'Photo & E-Mobility']
};

export const BRAND_COLORS = {
  primary: '#FE5900', // Orange
  secondary: '#141414', // Ink
  background: '#F9FAFB', // Light Gray
};
