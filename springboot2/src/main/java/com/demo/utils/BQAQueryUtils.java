package com.demo.utils;

import com.demo.annotation.BQAQuery;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.util.ReflectionUtils;

import java.util.regex.Pattern;

public class BQAQueryUtils {

    public static Query buildQuery(Object obj) {
        Query query = new Query();
        if (obj == null) {
            return query;
        }

        ReflectionUtils.doWithFields(obj.getClass(), field -> {
            BQAQuery annotation = field.getAnnotation(BQAQuery.class);
            if (annotation == null) {
                return;
            }

            ReflectionUtils.makeAccessible(field);
            Object value = field.get(obj);

            if (value == null) {
                return;
            }

            if (value instanceof String && ((String) value).isEmpty()) {
                return;
            }

            String column = annotation.column().isEmpty() ? field.getName() : annotation.column();

            if (annotation.fuzzy() && value instanceof String) {
                Pattern pattern = Pattern.compile(".*" + Pattern.quote((String) value) + ".*", Pattern.CASE_INSENSITIVE);
                query.addCriteria(Criteria.where(column).regex(pattern));
            } else {
                query.addCriteria(Criteria.where(column).is(value));
            }
        }, field -> field.isAnnotationPresent(BQAQuery.class));

        return query;
    }
}
