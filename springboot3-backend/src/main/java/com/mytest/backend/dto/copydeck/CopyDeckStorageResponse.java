package com.mytest.backend.dto.copydeck;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CopyDeckStorageResponse {

    private String storage;
    private String confluenceTitle;

}
