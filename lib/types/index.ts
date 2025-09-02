import { Database } from './database';

// Database table types
export type Org = Database['public']['Tables']['orgs']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type OrgMember = Database['public']['Tables']['org_members']['Row'];
export type InboxAlias = Database['public']['Tables']['inbox_aliases']['Row'];
export type Email = Database['public']['Tables']['emails']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type MerchantMapping = Database['public']['Tables']['merchant_map']['Row'];
export type ProcessingLog = Database['public']['Tables']['processing_logs']['Row'];
export type RateLimit = Database['public']['Tables']['rate_limits']['Row'];

// Insert types
export type InsertOrg = Database['public']['Tables']['orgs']['Insert'];
export type InsertUser = Database['public']['Tables']['users']['Insert'];
export type InsertOrgMember = Database['public']['Tables']['org_members']['Insert'];
export type InsertInboxAlias = Database['public']['Tables']['inbox_aliases']['Insert'];
export type InsertEmail = Database['public']['Tables']['emails']['Insert'];
export type InsertTransaction = Database['public']['Tables']['transactions']['Insert'];
export type InsertMerchantMapping = Database['public']['Tables']['merchant_map']['Insert'];
export type InsertProcessingLog = Database['public']['Tables']['processing_logs']['Insert'];
export type InsertRateLimit = Database['public']['Tables']['rate_limits']['Insert'];

// Update types
export type UpdateOrg = Database['public']['Tables']['orgs']['Update'];
export type UpdateUser = Database['public']['Tables']['users']['Update'];
export type UpdateOrgMember = Database['public']['Tables']['org_members']['Update'];
export type UpdateInboxAlias = Database['public']['Tables']['inbox_aliases']['Update'];
export type UpdateEmail = Database['public']['Tables']['emails']['Update'];
export type UpdateTransaction = Database['public']['Tables']['transactions']['Update'];
export type UpdateMerchantMapping = Database['public']['Tables']['merchant_map']['Update'];
export type UpdateProcessingLog = Database['public']['Tables']['processing_logs']['Update'];
export type UpdateRateLimit = Database['public']['Tables']['rate_limits']['Update'];

// Email processing types
export interface ParsedEmail {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
}

export interface EmailAttachment {
  filename?: string;
  contentType: string;
  size: number;
  content: Buffer;
}

// AI processing types
export interface ReceiptData {
  date: string;
  amount: number;
  currency: string;
  merchant: string;
  last4: string | null;
  category: string;
  subcategory: string | null;
  notes: string | null;
  confidence: number;
  explanation: string;
}

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  sourceLanguage: string;
  confidence: number;
}

// Processing state types
export type ProcessingStatus = 'received' | 'parsing' | 'translating' | 'extracting' | 'completed' | 'failed';

export interface EmailProcessingState {
  messageId: string;
  status: ProcessingStatus;
  progress: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// Error types
export enum ProcessingErrorType {
  HMAC_VERIFICATION_FAILED = 'hmac_verification_failed',
  EMAIL_PARSE_FAILED = 'email_parse_failed',
  TRANSLATION_FAILED = 'translation_failed',
  EXTRACTION_FAILED = 'extraction_failed',
  DATABASE_ERROR = 'database_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
}

export interface ProcessingError {
  type: ProcessingErrorType;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}

// Webhook types
export interface InboundEmailRequest {
  signature: string;
  timestamp: string;
  token: string;
  'body-mime': string;
  'message-id': string;
  recipient: string;
  sender: string;
  subject: string;
}

// Dashboard types
export interface DashboardStats {
  monthToDateTotal: number;
  categoryBreakdown: CategoryBreakdown[];
  spendingTrend: SpendingTrendPoint[];
  recentTransactions: Transaction[];
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface SpendingTrendPoint {
  date: string;
  amount: number;
}

// User session types
export interface UserSession {
  user: User;
  org: Org;
  role: OrgMember['role'];
  inboxAlias?: InboxAlias;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Insights types
export interface InsightQuery {
  id: string;
  question: string;
  description: string;
  category: 'spending' | 'trends' | 'categories' | 'merchants';
}

export interface InsightResult {
  query: string;
  answer: string;
  data?: any;
  visualization?: 'chart' | 'table' | 'metric';
  confidence: number;
}

// Advanced Analytics types
export interface MonthlyReport {
  month: string;
  year: number;
  totalSpending: number;
  transactionCount: number;
  categoryBreakdown: CategorySpending[];
  topMerchants: MerchantSpending[];
  averageTransactionAmount: number;
  spendingDays: number;
}

export interface YearlyReport {
  year: number;
  totalSpending: number;
  transactionCount: number;
  monthlyBreakdown: MonthlySpending[];
  categoryBreakdown: CategorySpending[];
  topMerchants: MerchantSpending[];
  averageMonthlySpending: number;
  peakSpendingMonth: string;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  averageAmount: number;
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  count: number;
  averageAmount: number;
  category: string;
}

export interface MonthlySpending {
  month: string;
  amount: number;
  transactionCount: number;
}

export interface SpendingTrendAnalysis {
  currentPeriod: {
    amount: number;
    transactionCount: number;
    averageDaily: number;
  };
  previousPeriod: {
    amount: number;
    transactionCount: number;
    averageDaily: number;
  };
  change: {
    amount: number;
    percentage: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  prediction: {
    nextMonthEstimate: number;
    confidence: number;
    factors: string[];
  };
}

export interface Budget {
  id: string;
  orgId: string;
  category: string;
  monthlyLimit: number;
  currentSpending: number;
  remainingBudget: number;
  percentageUsed: number;
  isOverBudget: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  budgetId: string;
  category: string;
  alertType: 'warning' | 'exceeded' | 'approaching';
  currentSpending: number;
  budgetLimit: number;
  percentageUsed: number;
  message: string;
  createdAt: Date;
}

export interface ComparativeAnalysis {
  currentPeriod: {
    start: Date;
    end: Date;
    totalSpending: number;
    transactionCount: number;
    categoryBreakdown: CategorySpending[];
  };
  comparisonPeriod: {
    start: Date;
    end: Date;
    totalSpending: number;
    transactionCount: number;
    categoryBreakdown: CategorySpending[];
  };
  changes: {
    totalSpendingChange: number;
    totalSpendingPercentage: number;
    transactionCountChange: number;
    categoryChanges: Array<{
      category: string;
      change: number;
      percentage: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  };
  insights: string[];
}

// Export database type for Supabase client
export type { Database };