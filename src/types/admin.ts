export interface AdminFeedbackItem {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
  status: "new" | "reviewing" | "resolved" | string;
  source: string;
  category: string;
  rating?: number | null;
  helpful?: boolean | null;
  reasons: string[];
  message: string;
  contactEmail?: string | null;
  route?: string | null;
  appVersion?: string | null;
  userId?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  authorPicture?: string | null;
  context: Record<string, unknown>;
}

export interface AdminOverview {
  fromDate: string;
  toDate: string;
  analytics: {
    totalEvents: number;
    pageViews: number;
    daily: Array<{ date: string; events: number }>;
    topEvents: Array<{ name: string; count: number }>;
    topRoutes: Array<{ route: string; count: number }>;
  };
  feedback: {
    total: number;
    new: number;
    averageRating?: number | null;
    helpfulRate?: number | null;
    categories: Record<string, number>;
  };
  recentFeedback: AdminFeedbackItem[];
}

export interface AdminGoogleAnalyticsReport {
  status: "not_configured" | "connected" | "error";
  propertyId?: string | null;
  activeUsers?: number | null;
  newUsers?: number | null;
  sessions?: number | null;
  screenPageViews?: number | null;
  channelGroups: Array<{ name: string; sessions: number }>;
  message?: string | null;
}

export interface AdminAccessUser {
  id: string;
  email: string;
  name?: string | null;
  roles: string[];
}
