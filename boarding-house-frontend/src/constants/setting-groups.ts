import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  FileClock,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import type { SettingSection } from "@/types/admin-setting";

export interface SettingNavItem {
  section: SettingSection;
  label: string;
  description: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
}
export const settingNavigation: SettingNavItem[] = [
  {
    section: "overview",
    label: "Tổng quan",
    description: "Trạng thái cấu hình",
    icon: LayoutDashboard,
  },
  {
    section: "profile",
    label: "Hồ sơ quản trị",
    description: "Thông tin cá nhân",
    icon: UserRound,
  },
  {
    section: "general",
    label: "Cài đặt chung",
    description: "Thương hiệu và vùng",
    icon: Settings2,
    ownerOnly: true,
  },
  {
    section: "organization",
    label: "Thông tin đơn vị",
    description: "Chủ nhà và doanh nghiệp",
    icon: Landmark,
    ownerOnly: true,
  },
  {
    section: "properties",
    label: "Cấu hình khu trọ",
    description: "Quy tắc theo từng cơ sở",
    icon: Building2,
  },
  {
    section: "rental",
    label: "Quy tắc thuê phòng",
    description: "Cọc, thời hạn và cư trú",
    icon: ClipboardList,
    ownerOnly: true,
  },
  {
    section: "contracts",
    label: "Hợp đồng",
    description: "Mã, mẫu và phê duyệt",
    icon: FileText,
    ownerOnly: true,
  },
  {
    section: "billing",
    label: "Hóa đơn và công nợ",
    description: "Chu kỳ và nhắc hạn",
    icon: Receipt,
    ownerOnly: true,
  },
  {
    section: "utilities",
    label: "Điện nước và dịch vụ",
    description: "Đơn giá mặc định",
    icon: Zap,
    ownerOnly: true,
  },
  {
    section: "payments",
    label: "Thanh toán",
    description: "Tiền mặt, ngân hàng và QR",
    icon: CreditCard,
    ownerOnly: true,
  },
  {
    section: "notifications",
    label: "Thông báo",
    description: "Kênh và sự kiện",
    icon: Bell,
    ownerOnly: true,
  },
  {
    section: "security",
    label: "Bảo mật",
    description: "Phiên và chính sách mật khẩu",
    icon: ShieldCheck,
    ownerOnly: true,
  },
  {
    section: "ai",
    label: "Trí tuệ nhân tạo",
    description: "Mô hình và tính năng",
    icon: Bot,
    ownerOnly: true,
  },
  {
    section: "integrations",
    label: "Tích hợp",
    description: "Kết nối dịch vụ ngoài",
    icon: Gauge,
    ownerOnly: true,
  },
  {
    section: "audit-logs",
    label: "Nhật ký thay đổi",
    description: "Lịch sử cấu hình",
    icon: FileClock,
    ownerOnly: true,
  },
];

export type FieldType =
  "text" | "email" | "tel" | "number" | "textarea" | "switch" | "select";
export interface SettingField {
  key: string;
  label: string;
  description?: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  required?: boolean;
  wide?: boolean;
}
export const groupFields: Partial<Record<SettingSection, SettingField[]>> = {
  general: [
    { key: "systemName", label: "Tên hệ thống", type: "text", required: true },
    { key: "supportEmail", label: "Email hỗ trợ", type: "email" },
    { key: "supportPhone", label: "Số điện thoại hỗ trợ", type: "tel" },
    {
      key: "defaultLanguage",
      label: "Ngôn ngữ mặc định",
      type: "select",
      options: [
        { value: "vi", label: "Tiếng Việt" },
        { value: "en", label: "English" },
      ],
    },
    {
      key: "timezone",
      label: "Múi giờ",
      type: "select",
      options: [
        { value: "Asia/Ho_Chi_Minh", label: "Việt Nam (UTC+7)" },
        { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
      ],
    },
    {
      key: "currency",
      label: "Đơn vị tiền tệ",
      type: "select",
      options: [
        { value: "VND", label: "Việt Nam đồng (VND)" },
        { value: "USD", label: "US Dollar (USD)" },
      ],
    },
    {
      key: "dateFormat",
      label: "Định dạng ngày",
      type: "select",
      options: [
        { value: "dd/MM/yyyy", label: "dd/MM/yyyy" },
        { value: "yyyy-MM-dd", label: "yyyy-MM-dd" },
      ],
    },
    {
      key: "timeFormat",
      label: "Định dạng giờ",
      type: "select",
      options: [
        { value: "HH:mm", label: "24 giờ" },
        { value: "hh:mm a", label: "12 giờ" },
      ],
    },
  ],
  profile: [
    { key: "fullName", label: "Họ và tên", type: "text", required: true },
    { key: "phone", label: "Số điện thoại", type: "tel" },
    { key: "contactEmail", label: "Email liên hệ", type: "email" },
    { key: "jobTitle", label: "Chức vụ", type: "text" },
    {
      key: "interfaceLanguage",
      label: "Ngôn ngữ giao diện",
      type: "select",
      options: [
        { value: "vi", label: "Tiếng Việt" },
        { value: "en", label: "English" },
      ],
    },
    {
      key: "personalTimezone",
      label: "Múi giờ cá nhân",
      type: "select",
      options: [
        { value: "Asia/Ho_Chi_Minh", label: "Việt Nam (UTC+7)" },
        { value: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
      ],
    },
    {
      key: "documentSignature",
      label: "Chữ ký hiển thị",
      type: "textarea",
      wide: true,
    },
  ],
  organization: [
    {
      key: "businessName",
      label: "Tên chủ nhà / đơn vị",
      type: "text",
      required: true,
    },
    { key: "businessCode", label: "Mã đơn vị", type: "text" },
    { key: "phone", label: "Số điện thoại", type: "tel" },
    { key: "email", label: "Email", type: "email" },
    { key: "address", label: "Địa chỉ", type: "textarea", wide: true },
    { key: "taxCode", label: "Mã số thuế", type: "text" },
    { key: "representativeName", label: "Người đại diện", type: "text" },
    { key: "representativeTitle", label: "Chức vụ", type: "text" },
    {
      key: "documentFooter",
      label: "Chân trang chứng từ",
      type: "textarea",
      wide: true,
    },
  ],
  properties: [
    { key: "propertyName", label: "Tên khu trọ", type: "text", required: true },
    { key: "managerName", label: "Người phụ trách", type: "text" },
    { key: "managerPhone", label: "Điện thoại quản lý", type: "tel" },
    { key: "managerEmail", label: "Email quản lý", type: "email" },
    { key: "workingHours", label: "Giờ làm việc", type: "text" },
    {
      key: "billingDay",
      label: "Ngày thu tiền mặc định",
      type: "number",
      min: 1,
      max: 31,
    },
    {
      key: "paymentDueDay",
      label: "Ngày đến hạn",
      type: "number",
      min: 1,
      max: 31,
    },
    {
      key: "meterReadingDay",
      label: "Ngày ghi điện nước",
      type: "number",
      min: 1,
      max: 31,
    },
    {
      key: "defaultMaximumOccupants",
      label: "Số người tối đa mặc định",
      type: "number",
      min: 1,
      max: 20,
    },
    { key: "quietHoursStart", label: "Bắt đầu giờ yên tĩnh", type: "text" },
    { key: "quietHoursEnd", label: "Kết thúc giờ yên tĩnh", type: "text" },
    { key: "allowPets", label: "Cho phép nuôi thú cưng", type: "switch" },
    { key: "allowVisitors", label: "Cho phép khách đến thăm", type: "switch" },
    {
      key: "visitorRules",
      label: "Quy định khách đến thăm",
      type: "textarea",
      wide: true,
    },
    {
      key: "vehicleRules",
      label: "Quy định phương tiện",
      type: "textarea",
      wide: true,
    },
    { key: "houseRules", label: "Nội quy chung", type: "textarea", wide: true },
    {
      key: "emergencyContact",
      label: "Liên hệ khẩn cấp",
      type: "text",
      wide: true,
    },
  ],
  rental: [
    {
      key: "defaultDepositMonths",
      label: "Số tháng tiền cọc mặc định",
      type: "number",
      min: 0,
      max: 24,
    },
    {
      key: "minimumRentalMonths",
      label: "Số tháng thuê tối thiểu",
      type: "number",
      min: 1,
      max: 120,
    },
    {
      key: "paymentCycle",
      label: "Chu kỳ thanh toán",
      type: "select",
      options: [
        { value: "MONTHLY", label: "Hàng tháng" },
        { value: "TWO_MONTHS", label: "Hai tháng" },
        { value: "QUARTERLY", label: "Ba tháng" },
      ],
    },
    {
      key: "defaultPaymentDueDay",
      label: "Ngày đến hạn mặc định",
      type: "number",
      min: 1,
      max: 31,
    },
    {
      key: "gracePeriodDays",
      label: "Số ngày được phép trễ",
      type: "number",
      min: 0,
      max: 90,
    },
    {
      key: "noticePeriodDays",
      label: "Số ngày báo trước trả phòng",
      type: "number",
      min: 0,
      max: 365,
    },
    {
      key: "lateFeeEnabled",
      label: "Tính phí chậm thanh toán",
      type: "switch",
    },
    {
      key: "allowPartialPayment",
      label: "Cho phép thanh toán một phần",
      type: "switch",
    },
    {
      key: "occupantApprovalRequired",
      label: "Phê duyệt người ở cùng",
      type: "switch",
    },
    { key: "reservationEnabled", label: "Cho phép giữ phòng", type: "switch" },
  ],
  contracts: [
    {
      key: "contractCodePrefix",
      label: "Tiền tố mã hợp đồng",
      type: "text",
      required: true,
    },
    {
      key: "codePattern",
      label: "Quy tắc sinh mã",
      type: "text",
      description: "Ví dụ: {PREFIX}-{YEAR}-{SEQUENCE}",
    },
    {
      key: "defaultContractType",
      label: "Loại hợp đồng mặc định",
      type: "select",
      options: [
        { value: "FIXED_TERM", label: "Có thời hạn" },
        { value: "INDEFINITE_TERM", label: "Không xác định thời hạn" },
      ],
    },
    {
      key: "defaultDurationMonths",
      label: "Thời hạn mặc định (tháng)",
      type: "number",
      min: 1,
      max: 120,
    },
    {
      key: "expiryWarningDays",
      label: "Cảnh báo trước khi hết hạn",
      type: "number",
      min: 1,
      max: 365,
    },
    {
      key: "onlineExtensionEnabled",
      label: "Cho phép gia hạn trực tuyến",
      type: "switch",
    },
    {
      key: "terminationRequestEnabled",
      label: "Cho phép yêu cầu trả phòng",
      type: "switch",
    },
    {
      key: "tenantConfirmationRequired",
      label: "Yêu cầu khách thuê xác nhận",
      type: "switch",
    },
    {
      key: "electronicSignatureEnabled",
      label: "Sử dụng chữ ký điện tử",
      type: "switch",
    },
    {
      key: "defaultTerms",
      label: "Điều khoản mặc định",
      type: "textarea",
      wide: true,
    },
  ],
  billing: [
    {
      key: "autoGenerateInvoices",
      label: "Tự động tạo hóa đơn hàng tháng",
      type: "switch",
    },
    {
      key: "invoiceGenerationDay",
      label: "Ngày lập hóa đơn",
      type: "number",
      min: 1,
      max: 31,
    },
    {
      key: "defaultDueDay",
      label: "Ngày đến hạn mặc định",
      type: "number",
      min: 1,
      max: 31,
    },
    {
      key: "allowPartialPayment",
      label: "Cho phép thanh toán một phần",
      type: "switch",
    },
    { key: "carryForwardDebt", label: "Cộng công nợ kỳ trước", type: "switch" },
    {
      key: "lateFeeEnabled",
      label: "Tính phí chậm thanh toán",
      type: "switch",
    },
    {
      key: "lateFeeType",
      label: "Cách tính phí chậm",
      type: "select",
      options: [
        { value: "FIXED", label: "Số tiền cố định" },
        { value: "PERCENT", label: "Phần trăm" },
        { value: "PER_DAY", label: "Theo ngày" },
      ],
    },
    { key: "lateFeeValue", label: "Giá trị phí chậm", type: "number", min: 0 },
    {
      key: "reminderDaysBeforeDue",
      label: "Ngày nhắc trước hạn",
      description: "Phân cách bằng dấu phẩy, ví dụ 3, 1",
      type: "text",
    },
    {
      key: "reminderDaysAfterDue",
      label: "Ngày nhắc sau hạn",
      description: "Phân cách bằng dấu phẩy, ví dụ 1, 3, 7",
      type: "text",
    },
    {
      key: "requireCancellationReason",
      label: "Yêu cầu lý do khi hủy hóa đơn",
      type: "switch",
    },
  ],
  utilities: [
    {
      key: "electricityCalculation",
      label: "Cách tính điện",
      type: "select",
      options: [
        { value: "METER", label: "Theo công tơ" },
        { value: "TIERED", label: "Theo bậc" },
        { value: "FIXED", label: "Cố định" },
      ],
    },
    {
      key: "electricityUnitPrice",
      label: "Đơn giá điện mặc định",
      type: "number",
      min: 0,
    },
    { key: "electricityUnit", label: "Đơn vị điện", type: "text" },
    {
      key: "waterCalculation",
      label: "Cách tính nước",
      type: "select",
      options: [
        { value: "METER", label: "Theo công tơ" },
        { value: "PER_PERSON", label: "Theo người" },
        { value: "PER_ROOM", label: "Theo phòng" },
        { value: "FIXED", label: "Cố định" },
      ],
    },
    {
      key: "waterUnitPrice",
      label: "Đơn giá nước mặc định",
      type: "number",
      min: 0,
    },
    { key: "waterUnit", label: "Đơn vị nước", type: "text" },
    { key: "meterPhotoRequired", label: "Yêu cầu ảnh công tơ", type: "switch" },
    {
      key: "anomalyWarningEnabled",
      label: "Cảnh báo tiêu thụ bất thường",
      type: "switch",
    },
  ],
  payments: [
    { key: "cashEnabled", label: "Chấp nhận tiền mặt", type: "switch" },
    {
      key: "bankTransferEnabled",
      label: "Chấp nhận chuyển khoản",
      type: "switch",
    },
    { key: "bankName", label: "Ngân hàng", type: "text" },
    { key: "accountName", label: "Chủ tài khoản", type: "text" },
    { key: "accountNumber", label: "Số tài khoản", type: "text" },
    { key: "bankBranch", label: "Chi nhánh", type: "text" },
    {
      key: "transferContent",
      label: "Nội dung chuyển khoản mẫu",
      type: "text",
      wide: true,
    },
    { key: "qrEnabled", label: "Hiển thị mã QR", type: "switch" },
  ],
  notifications: [
    { key: "inAppEnabled", label: "Thông báo trong hệ thống", type: "switch" },
    { key: "emailEnabled", label: "Gửi qua email", type: "switch" },
    { key: "webPushEnabled", label: "Web Push", type: "switch" },
    { key: "invoiceCreated", label: "Hóa đơn mới", type: "switch" },
    { key: "invoiceDue", label: "Hóa đơn sắp đến hạn", type: "switch" },
    { key: "invoiceOverdue", label: "Hóa đơn quá hạn", type: "switch" },
    { key: "contractExpiring", label: "Hợp đồng sắp hết hạn", type: "switch" },
    {
      key: "maintenanceCreated",
      label: "Yêu cầu sửa chữa mới",
      type: "switch",
    },
    { key: "defaultSendTime", label: "Giờ gửi mặc định", type: "text" },
    {
      key: "reminderDaysBefore",
      label: "Số ngày nhắc trước",
      type: "number",
      min: 0,
      max: 90,
    },
  ],
  security: [
    {
      key: "accessTokenMinutes",
      label: "Thời hạn access token (phút)",
      type: "number",
      min: 5,
      max: 1440,
    },
    {
      key: "refreshTokenDays",
      label: "Thời hạn refresh token (ngày)",
      type: "number",
      min: 1,
      max: 365,
    },
    {
      key: "maxFailedLogins",
      label: "Số lần đăng nhập sai tối đa",
      type: "number",
      min: 3,
      max: 20,
    },
    {
      key: "lockDurationMinutes",
      label: "Thời gian khóa (phút)",
      type: "number",
      min: 1,
      max: 1440,
    },
    {
      key: "minimumPasswordLength",
      label: "Độ dài mật khẩu tối thiểu",
      type: "number",
      min: 8,
      max: 128,
    },
    { key: "requireUppercase", label: "Yêu cầu chữ hoa", type: "switch" },
    { key: "requireLowercase", label: "Yêu cầu chữ thường", type: "switch" },
    { key: "requireNumber", label: "Yêu cầu chữ số", type: "switch" },
    {
      key: "requireSpecialCharacter",
      label: "Yêu cầu ký tự đặc biệt",
      type: "switch",
    },
    { key: "twoFactorEnabled", label: "Xác thực hai bước", type: "switch" },
    {
      key: "unusualLoginAlert",
      label: "Cảnh báo đăng nhập bất thường",
      type: "switch",
    },
  ],
  ai: [
    { key: "enabled", label: "Bật tính năng AI", type: "switch", wide: true },
    {
      key: "provider",
      label: "Nhà cung cấp",
      type: "select",
      options: [
        { value: "GOOGLE", label: "Google" },
        { value: "OPENAI", label: "OpenAI" },
        { value: "AZURE_OPENAI", label: "Azure OpenAI" },
      ],
    },
    { key: "model", label: "Tên mô hình", type: "text" },
    {
      key: "monthlyRequestLimit",
      label: "Giới hạn yêu cầu / tháng",
      type: "number",
      min: 0,
      max: 10000000,
    },
    {
      key: "responseLanguage",
      label: "Ngôn ngữ phản hồi",
      type: "select",
      options: [
        { value: "vi", label: "Tiếng Việt" },
        { value: "en", label: "English" },
      ],
    },
    {
      key: "requestTimeoutSeconds",
      label: "Timeout (giây)",
      type: "number",
      min: 5,
      max: 300,
    },
    { key: "tenantChatbot", label: "Chatbot khách thuê", type: "switch" },
    { key: "invoiceExplanation", label: "Giải thích hóa đơn", type: "switch" },
    {
      key: "contractExplanation",
      label: "Giải thích hợp đồng",
      type: "switch",
    },
    {
      key: "maintenanceClassification",
      label: "Phân loại sửa chữa",
      type: "switch",
    },
    {
      key: "utilityAnomalyDetection",
      label: "Phát hiện điện nước bất thường",
      type: "switch",
    },
    {
      key: "storeConversationHistory",
      label: "Lưu lịch sử hội thoại",
      type: "switch",
    },
    {
      key: "historyRetentionDays",
      label: "Số ngày lưu lịch sử",
      type: "number",
      min: 1,
      max: 3650,
    },
    {
      key: "requireActionConfirmation",
      label: "Xác nhận trước hành động",
      type: "switch",
    },
  ],
  integrations: [
    { key: "emailEnabled", label: "Email SMTP đã bật", type: "switch" },
    { key: "webPushEnabled", label: "Web Push đã bật", type: "switch" },
    { key: "zaloEnabled", label: "Zalo đã bật", type: "switch" },
    { key: "paymentEnabled", label: "Cổng thanh toán đã bật", type: "switch" },
    { key: "cloudStorageEnabled", label: "Lưu trữ đám mây", type: "switch" },
    { key: "mapsEnabled", label: "Google Maps", type: "switch" },
  ],
};
