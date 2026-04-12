package com.zhou4h.springboot3.dto;

import lombok.Data;

import java.util.List;

@Data
public class Jql {

    private int startAt;
    private int maxResults;
    private String jql;
    private List<String> fields;

}
