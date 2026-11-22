package com.thangit.boardinghouse.service;
import java.math.BigDecimal;
import java.math.RoundingMode;
/** Current occupancy denominator excludes INACTIVE and MAINTENANCE rooms. */
public final class ReportKpis {
 private ReportKpis(){}
 public static BigDecimal occupancy(Object occupied,Object available){var d=new BigDecimal(java.util.Objects.toString(available,"0"));return d.signum()==0?BigDecimal.ZERO:new BigDecimal(java.util.Objects.toString(occupied,"0")).multiply(BigDecimal.valueOf(100)).divide(d,2,RoundingMode.HALF_UP);}
}
