package com.mytest.backend.service;

import org.springframework.stereotype.Service;

@Service
public class UserService {

    private static final String CONFLUENCE_TOKEN = "MjAzNTcxNjM0NjIzOhsdNe9Eq9ooeipUDLqQ3r3JHLGY";


    public String getConfluenceAlmToken(String staffId) {
        return CONFLUENCE_TOKEN;
    }

    public String getConfluenceWpbToken(String staffId) {
        return CONFLUENCE_TOKEN;
    }
}
