package com.zhou4h.backend.utils;

import org.springframework.ai.content.Media;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;

import java.util.Base64;
import java.util.function.Function;

public class IntegrationUtils {

    /**
     * Converts a data URL (base64 encoded image) to Spring AI Media object
     * Supports data URLs in the format: data:image/png;base64,iVBORw0KGgo...
     */
    public static Media connverDataUrlToMedia(String dataUrl) {
        String[] parts = dataUrl.split(",", 2);

        String metaData = parts[0];
        String base64Data = parts[1];
        String[] metaParts = metaData.split(";");
        String[] typeParts = metaParts[0].split(":");
        String mimeType= typeParts[1];
        byte[] data;
        try{
            data = java.util.Base64.getDecoder().decode(base64Data);
        }catch (Exception e) {
            return null;
        }
        return Media.builder().data(data).mimeType(MediaType.parseMediaType(mimeType)).build();
    }
}
