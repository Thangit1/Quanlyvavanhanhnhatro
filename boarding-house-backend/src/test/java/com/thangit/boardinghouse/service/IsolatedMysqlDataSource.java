package com.thangit.boardinghouse.service;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.SQLException;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** Keeps existing fixture metadata API while preventing Windows ephemeral socket exhaustion. */
final class IsolatedMysqlDataSource extends DriverManagerDataSource implements AutoCloseable {
    private final HikariDataSource pool;
    IsolatedMysqlDataSource(String url,String user,String password){
        super(url,user,password);
        pool=new HikariDataSource();pool.setJdbcUrl(url);pool.setUsername(user);pool.setPassword(password);
        pool.setMaximumPoolSize(4);pool.setMinimumIdle(0);pool.setIdleTimeout(10000);
        pool.setConnectionTimeout(15000);pool.setPoolName("isolated-mysql-"+Integer.toHexString(System.identityHashCode(this)));
        Runtime.getRuntime().addShutdownHook(new Thread(pool::close));
    }
    @Override public Connection getConnection() throws SQLException {
        Connection connection=pool.getConnection();
        try(var statement=connection.createStatement()) {statement.execute("SET timestamp=DEFAULT");}
        catch(SQLException failure){connection.close();throw failure;}
        return connection;
    }
    @Override public Connection getConnection(String user,String password) throws SQLException {
        return java.util.Objects.equals(user,getUsername())&&java.util.Objects.equals(password,getPassword())
                ?getConnection():super.getConnection(user,password);
    }
    @Override public void close(){pool.close();}
}
