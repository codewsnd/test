package com.demo.model;

import com.demo.annotation.BQAQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashSet;
import java.util.Set;

@Data
@EqualsAndHashCode(callSuper = true)
@Document
public class Prompt extends BaseModel {

    private static final long serialVersionUID = 1L;
    @BQAQuery(fuzzy = true)
    private String title;
    @BQAQuery(fuzzy = true)
    private String description;
    private String detail;
    private String category;
    private Integer likeCount = 0;
    private Set<String> likedUserIds = new HashSet<>();
}
