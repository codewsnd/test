package com.demo.controller;

import com.demo.service.GridFsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class FileController {
    
    @Autowired
    private GridFsService gridFsService;

    // 文件上传接口
    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> result = gridFsService.storeFile(file);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("文件上传失败: " + e.getMessage());
        }
    }
    
    // 图片访问接口
    @GetMapping("/image/{id}")
    public ResponseEntity<InputStreamResource> getImage(@PathVariable String id) {
        try {
            // 获取文件元数据
            Map<String, Object> metadata = gridFsService.getFileMetadata(id);
            if (metadata == null) {
                return ResponseEntity.notFound().build();
            }

            // 获取内容类型
//            String contentType = (String) metadata.getOrDefault("contentType", "application/octet-stream");

            // 获取文件流
            InputStream inputStream = gridFsService.getFileStream(id);

            // 设置正确的响应头
            return ResponseEntity.ok()
//                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + metadata.get("filename") + "\"")
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000") // 1年缓存
                    .body(new InputStreamResource(inputStream));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 获取文件元数据
    @GetMapping("/file/{id}/metadata")
    public ResponseEntity<Map<String, Object>> getFileMetadata(@PathVariable String id) {
        Map<String, Object> metadata = gridFsService.getFileMetadata(id);
        return metadata != null ? 
            ResponseEntity.ok(metadata) : 
            ResponseEntity.notFound().build();
    }
}