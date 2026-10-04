export type EscrowState = 'funding' | 'active' | 'completed' | 'cancelled' | 'disputed'

export interface Project {
  id: string;
  title: string;
  description: string;
  budget: number;
  slots: number;
  status: EscrowState;
}

export interface User {
  id: string;
  role: 'poster' | 'tester';
  name: string;
}

export interface DemographicTarget {
  age_group?: string | string[];
  gender?: string | string[];
  employment_status?: string | string[];
  tech_literacy?: string | string[];
  ageGroup?: string | string[];
  employmentStatus?: string | string[];
  techLiteracy?: string | string[];
  location?: string | string[];
  device_types?: string | string[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'payout_approved' | 'submission_update' | 'new_listing' | 'dispute_update';
  is_read: boolean;
  created_at: string;
  link_url?: string;
}

export interface NotificationSettings {
  email_payouts: boolean;
  email_submissions: boolean;
  email_listings: boolean;
  email_disputes: boolean;
}

export interface UserProfile {
  id: string;
  role: 'poster' | 'tester';
  full_name?: string;
  phone?: string | null;
  age_group?: string | null;
  gender?: string | null;
  employment_status?: string | null;
  tech_literacy?: string | null;
  accessibility_tags?: string[];
  location?: string | null;
  device_types?: string[] | string | null;
  crypto_wallet_address?: string | null;
  preferred_payout_rail?: 'gcash' | 'maya' | 'crypto_wallet';
  notification_settings?: NotificationSettings;
  created_at?: string;
  updated_at?: string;
}

export interface QuickImpressionTask {
  id: string;
  listing_id?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  image_url?: string;
  websiteUrl?: string;
  website_url?: string;
  previewUrl?: string;
  durationSeconds?: number;
  impression_duration_seconds?: number;
  recallQuestion?: string;
  question_text?: string;
}

