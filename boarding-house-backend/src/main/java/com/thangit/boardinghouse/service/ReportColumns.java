package com.thangit.boardinghouse.service;
import java.util.Map;
/** Human headers and units; raw source field names remain in export metadata. */
public final class ReportColumns {
 private ReportColumns(){}
 private static final Map<String,String> LABELS=Map.ofEntries(
  Map.entry("code","Mã / tên"),Map.entry("property_name","Nhà trọ"),Map.entry("event_date","Ngày / kỳ"),Map.entry("status","Trạng thái"),Map.entry("category","Phân loại"),Map.entry("amount","Giá trị (VNĐ, theo cơ sở báo cáo)"),Map.entry("tenant_name","Người thuê"),Map.entry("room_code","Phòng"),Map.entry("contract_code","Hợp đồng"),Map.entry("paid_amount","Đã thanh toán (VNĐ)"),Map.entry("remaining_amount","Còn phải thu (VNĐ)"),Map.entry("cash_in","Tiền vào (VNĐ)"),Map.entry("cash_out","Tiền ra (VNĐ)"),Map.entry("due_date","Hạn thanh toán"),Map.entry("overdue_days","Số ngày quá hạn"),Map.entry("required_amount","Cọc yêu cầu (VNĐ)"),Map.entry("balance_amount","Cọc đang giữ (VNĐ)"),Map.entry("received_amount","Cọc đã nhận hợp lệ (VNĐ)"),Map.entry("payable","Còn phải trả (VNĐ)"),Map.entry("unit","Đơn vị"),Map.entry("quantity","Số lượng theo đơn vị"),Map.entry("electricity_kwh","Điện tiêu thụ (kWh)"),Map.entry("water_m3","Nước tiêu thụ (m³)"),Map.entry("collected_amount","Thực thu phân bổ (chưa có thì để trống)"),Map.entry("depreciated_value","Giá trị sau khấu hao (chưa hỗ trợ)"),Map.entry("move_in_date","Ngày vào"),Map.entry("move_out_date","Ngày ra"),Map.entry("method","Phương thức"));
 public static String title(String key){return LABELS.getOrDefault(key,key);}
}
