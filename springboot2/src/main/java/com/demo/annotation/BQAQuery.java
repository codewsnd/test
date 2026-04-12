package com.demo.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.METHOD})
public @interface BQAQuery {

    boolean fuzzy() default false;

    String column() default "";

    boolean orOperator() default false;;
    boolean inOperator() default false;;
    boolean ignoreCDase() default false;;

}
