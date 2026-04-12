package com.demo.model;

import com.demo.annotation.BQAQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@Document
public class SelectOption extends BaseModel {

    @BQAQuery
    private String name;
    @BQAQuery
    private String module;
    private List<Option> options;

    @Data
    public static class Option {
        private String value;
        private String label;
        private Integer sortOrder;
    }
}

