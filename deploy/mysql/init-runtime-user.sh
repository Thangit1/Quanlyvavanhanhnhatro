#!/bin/bash
create_smarthome_runtime_user() {
    local password=${SMARTHOME_DB_PASSWORD//\\/\\\\}
    password=${password//\'/\'\'}

    MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=SOCKET -u root <<SQL
CREATE USER 'smarthome_app'@'%' IDENTIFIED BY '$password';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON boarding_house_management.* TO 'smarthome_app'@'%';
SQL
}

create_smarthome_runtime_user
