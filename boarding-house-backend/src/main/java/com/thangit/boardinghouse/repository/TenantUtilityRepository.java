package com.thangit.boardinghouse.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public class TenantUtilityRepository {
    private final JdbcClient jdbc;

    public TenantUtilityRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ContractRoomRow> findActiveContractRooms(long tenantId) {
        return jdbc.sql("""
                SELECT c.id contract_id, r.id room_id, r.code room_code,
                       p.name property_name, p.address property_address
                FROM contracts c
                JOIN rooms r ON r.id=c.room_id
                JOIN properties p ON p.id=r.property_id
                WHERE c.tenant_id=:tenantId
                  AND c.status IN ('ACTIVE','EXPIRING','TERMINATION_REQUESTED')
                  AND c.start_date<=CURRENT_DATE AND c.end_date>=CURRENT_DATE
                ORDER BY c.start_date DESC, c.id DESC
                """)
                .param("tenantId", tenantId)
                .query((rs, rowNum) -> new ContractRoomRow(
                        rs.getLong("contract_id"), rs.getLong("room_id"),
                        rs.getString("room_code"), rs.getString("property_name"),
                        rs.getString("property_address")))
                .list();
    }

    public List<ReadingRow> findReadings(long tenantId, long contractId) {
        return jdbc.sql("""
                SELECT ur.id, ur.billing_period,
                       ur.electricity_previous, ur.electricity_current,ur.electricity_consumption,ur.water_consumption,
                       ur.electricity_unit_price, ur.electricity_amount,
                       ur.water_previous, ur.water_current,
                       ur.water_unit_price, ur.water_amount,
                       i.id invoice_id, i.code invoice_code, i.status invoice_status
                FROM utility_readings ur
                JOIN contracts c ON c.id=ur.contract_id AND c.tenant_id=:tenantId
                LEFT JOIN invoices i ON i.contract_id=ur.contract_id
                    AND i.billing_period=ur.billing_period AND i.status<>'CANCELLED'
                WHERE ur.contract_id=:contractId
                ORDER BY ur.billing_period DESC
                LIMIT 24
                """)
                .param("tenantId", tenantId)
                .param("contractId", contractId)
                .query((rs, rowNum) -> new ReadingRow(
                        rs.getLong("id"), rs.getObject("billing_period", LocalDate.class),
                        rs.getBigDecimal("electricity_previous"), rs.getBigDecimal("electricity_current"),
                        rs.getBigDecimal("electricity_unit_price"), rs.getBigDecimal("electricity_amount"),
                        rs.getBigDecimal("water_previous"), rs.getBigDecimal("water_current"),
                        rs.getBigDecimal("water_unit_price"), rs.getBigDecimal("water_amount"),
                        nullableLong(rs.getObject("invoice_id")), rs.getString("invoice_code"),
                        rs.getString("invoice_status"),rs.getBigDecimal("electricity_consumption"),rs.getBigDecimal("water_consumption")))
                .list();
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    public record ContractRoomRow(
            Long contractId, Long roomId, String roomCode,
            String propertyName, String propertyAddress
    ) {}

    public record ReadingRow(
            Long id, LocalDate period,
            BigDecimal electricityPrevious, BigDecimal electricityCurrent,
            BigDecimal electricityUnitPrice, BigDecimal electricityAmount,
            BigDecimal waterPrevious, BigDecimal waterCurrent,
            BigDecimal waterUnitPrice, BigDecimal waterAmount,
            Long invoiceId, String invoiceCode, String invoiceStatus,BigDecimal electricityConsumption,BigDecimal waterConsumption
    ) {
        public ReadingRow(Long id,LocalDate period,BigDecimal ep,BigDecimal ec,BigDecimal eprice,BigDecimal ea,BigDecimal wp,BigDecimal wc,BigDecimal wprice,BigDecimal wa,Long invoice,String code,String status){this(id,period,ep,ec,eprice,ea,wp,wc,wprice,wa,invoice,code,status,null,null);}
    }
}
