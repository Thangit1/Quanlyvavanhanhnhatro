export interface TenantHomeData {
  user: { id: number; fullName: string; avatarUrl: string | null; unreadNotificationCount: number };
  rental: null | { propertyName: string; propertyAddress: string; buildingName: string | null; floorName: string | null;
    roomId: number; roomCode: string; area: number | null; occupantCount: number; monthlyRent: number; roomImageUrl: string | null };
  contract: null | { id: number; contractCode: string; startDate: string; endDate: string; depositAmount: number;
    daysRemaining: number; status: string };
  currentInvoice: null | { id: number; code: string; billingPeriod: string; totalAmount: number; paidAmount: number;
    remainingAmount: number; dueDate: string; daysUntilDue: number; status: string; paidAt: string | null };
  utilityUsage: null | { electricity: Utility; water: Utility };
  recentMaintenanceRequests: Array<{ id: number; code: string; title: string; issueType: string; priority: string;
    status: string; assigneeName: string | null; createdAt: string }>;
  recentNotifications: Array<{ id: number; title: string; content: string; type: string; read: boolean; createdAt: string }>;
  utilityHistory: Array<{ period: string; electricityUsage: number | null; waterUsage: number | null }>;
}
export interface Utility { previousIndex: number | null; currentIndex: number | null; usage: number | null;
  unitPrice: number | null; amount: number | null }

export interface AdminDashboardData {
  availableProperties: Array<{ id: number; name: string }>;
  summary: { totalProperties: number; totalRooms: number; occupiedRooms: number; vacantRooms: number;
    reservedRooms: number; maintenanceRooms: number; occupancyRate: number; currentRevenue: number;
    previousRevenue: number; revenueChangePercent: number; outstandingDebt: number;
    expiringContracts: number; openMaintenanceRequests: number };
  roomStatusSummary: Array<{ status: string; count: number }>;
  revenueHistory: Array<{ period: string; revenue: number; expense: number; outstandingDebt: number }>;
  roomMap: Array<{ id: number; propertyName: string; buildingName: string | null; floorName: string | null;
    roomCode: string; tenantName: string | null; status: string; contractEndDate: string | null;
    outstandingDebt: number; hasOpenMaintenance: boolean }>;
  overdueInvoices: Array<{ id: number; code: string; roomCode: string; tenantName: string; billingPeriod: string;
    remainingAmount: number; dueDate: string; overdueDays: number; status: string }>;
  expiringContracts: Array<{ id: number; code: string; roomCode: string; tenantName: string;
    endDate: string; daysRemaining: number; status: string }>;
  maintenanceRequests: Array<{ id: number; code: string; propertyName: string; roomCode: string | null;
    title: string; issueType: string; priority: string; assigneeName: string | null; waitingHours: number; status: string }>;
  operationalAlerts: Array<{ code: string; severity: string; title: string; description: string; actionUrl: string }>;
  recentActivities: Array<{ id: number; type: string; description: string; actorName: string | null;
    targetUrl: string | null; createdAt: string }>;
  aiInsights: Array<{ label: string; content: string; confidence: number | null }>;
}
