package com.mytest.backend.dto.copydeck;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public  class ImageData {
    private String fileName;
    private String base64;
}
