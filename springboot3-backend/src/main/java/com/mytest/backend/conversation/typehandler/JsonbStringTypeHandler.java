package com.mytest.backend.conversation.typehandler;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

@MappedTypes(String.class)
@MappedJdbcTypes(JdbcType.OTHER)
public class JsonbStringTypeHandler extends BaseTypeHandler<String> {

    private static final String PG_OBJECT_CLASS_NAME = "org.postgresql.util.PGobject";

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType)
            throws SQLException {
        Object jsonbObject = createJsonbObject(parameter);
        if (jsonbObject != null) {
            ps.setObject(i, jsonbObject);
            return;
        }
        ps.setObject(i, parameter, Types.OTHER);
    }

    @Override
    public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return rs.getString(columnName);
    }

    @Override
    public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return rs.getString(columnIndex);
    }

    @Override
    public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return cs.getString(columnIndex);
    }

    private Object createJsonbObject(String value) throws SQLException {
        try {
            Class<?> pgObjectClass = Class.forName(PG_OBJECT_CLASS_NAME);
            Object pgObject = pgObjectClass.getDeclaredConstructor().newInstance();
            pgObjectClass.getMethod("setType", String.class).invoke(pgObject, "jsonb");
            pgObjectClass.getMethod("setValue", String.class).invoke(pgObject, value);
            return pgObject;
        } catch (ClassNotFoundException exception) {
            return null;
        } catch (ReflectiveOperationException exception) {
            throw new SQLException("Failed to create PostgreSQL jsonb object", exception);
        }
    }
}
