package com.mytest.springboot3.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class SearchRequest {

    private String apiPrefix;
    private String apiVersion;
    private String token;
    private Jql jql;
    private String employeeId;
    private Map<String, List<String>> tags;

}


