package com.thangit.boardinghouse.repository;

/** Physical occupancy is independent of account/profile status and contract expiry. */
final class ResidentSql {
    private ResidentSql() {}

    static String current(String alias) {
        return alias + ".status='ACTIVE' AND " + alias + ".room_id IS NOT NULL AND "
                + alias + ".move_in_date<=CURRENT_DATE AND (" + alias
                + ".move_out_date IS NULL OR " + alias + ".move_out_date>CURRENT_DATE)";
    }
}
