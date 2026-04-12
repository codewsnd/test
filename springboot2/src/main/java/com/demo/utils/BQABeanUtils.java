package com.demo.utils;

import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.beans.BeansException;
import org.springframework.util.Assert;

import java.beans.PropertyDescriptor;
import java.util.HashSet;
import java.util.Set;

public class BQABeanUtils {

    public static void copyProperties(Object source, Object target) {
        // Get property descriptors for both source and target
        BeanWrapper srcWrapper = new BeanWrapperImpl(source);
        BeanWrapper trgWrapper = new BeanWrapperImpl(target);

        // Get all property names from source
        PropertyDescriptor[] srcPds = srcWrapper.getPropertyDescriptors();

        for (PropertyDescriptor srcPd : srcPds) {
            String propertyName = srcPd.getName();

            // Skip internal properties
            if ("class".equals(propertyName)) {
                continue;
            }

            // Check if property is readable in source and writable in target
            if (srcWrapper.isReadableProperty(propertyName) &&
                    trgWrapper.isWritableProperty(propertyName)) {

                // Get value from source
                Object value = srcWrapper.getPropertyValue(propertyName);

                // Only copy non-null values
                if (value != null) {
                    trgWrapper.setPropertyValue(propertyName, value);
                }
            }
        }
    }

}
