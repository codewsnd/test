package com.demo.service;

import com.mongodb.BasicDBObject;
import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.GridFSBuckets;
import com.mongodb.client.gridfs.model.GridFSUploadOptions;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.gridfs.GridFsOperations;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Service
public class GridFsService {
    
    private static final Set<String> ALLOWED_CONTENT_TYPES = 
        Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    
    @Autowired
    private MongoTemplate mongoTemplate;
    
    @Autowired
    private GridFsOperations gridFsOperations;
    
    public Map<String, Object> storeFile(MultipartFile file) throws IOException {
        // 验证文件类型
        if (!ALLOWED_CONTENT_TYPES.contains(file.getContentType())) {
            throw new IllegalArgumentException("不支持的文件类型: " + file.getContentType());
        }
        
        // 验证文件大小
        if (file.getSize() > 5 * 1024 * 1024) { // 5MB
            throw new IllegalArgumentException("文件过大，最大允许5MB");
        }
        
        // 设置元数据
        Document metadata = new Document();
        metadata.append("originalFilename", file.getOriginalFilename());
        metadata.append("contentType", file.getContentType());
        metadata.append("uploadDate", new Date());
        
        // 创建上传选项
        GridFSUploadOptions options = new GridFSUploadOptions()
            .chunkSizeBytes(512 * 1024) // 512KB chunks
            .metadata(metadata);
        
        // 上传文件到 GridFS
        ObjectId fileId = gridFsOperations.store(
            file.getInputStream(), 
            file.getOriginalFilename(),
            options
        );
        
        // 构造返回结果
        Map<String, Object> result = new HashMap<>();
        result.put("id", fileId.toHexString());
        result.put("filename", file.getOriginalFilename());
        result.put("contentType", file.getContentType());
        result.put("size", file.getSize());
        result.put("url", "/api/image/" + fileId.toHexString());
        result.put("uploadDate", new Date());
        
        return result;
    }
    
    public InputStream getFileStream(String id) {
        GridFSBucket gridFSBucket = GridFSBuckets.create(mongoTemplate.getDb());
        return gridFSBucket.openDownloadStream(new ObjectId(id));
    }
    
    public void deleteFile(String id) {
        GridFSBucket gridFSBucket = GridFSBuckets.create(mongoTemplate.getDb());
        gridFSBucket.delete(new ObjectId(id));
    }
    
    public Map<String, Object> getFileMetadata(String id) {
        GridFSBucket gridFSBucket = GridFSBuckets.create(mongoTemplate.getDb());
        com.mongodb.client.gridfs.model.GridFSFile file = gridFSBucket.find(new BasicDBObject("_id", new ObjectId(id))).first();
        
        if (file == null) {
            return null;
        }
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("id", file.getObjectId().toHexString());
        metadata.put("filename", file.getFilename());
        metadata.put("length", file.getLength());
        metadata.put("uploadDate", file.getUploadDate());
        
        // 添加自定义元数据
        if (file.getMetadata() != null) {
            metadata.putAll(file.getMetadata());
        }
        
        return metadata;
    }
}