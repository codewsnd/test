package com.mytest.springboot3.repository;

import com.mytest.springboot3.entity.ChatDocumentInfo;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface ChatDocumentInfoRepository extends ReactiveCrudRepository<ChatDocumentInfo, Long> {

    @Query("SELECT * FROM chat_document_info WHERE status = :status ORDER BY upload_time DESC")
    Flux<ChatDocumentInfo> findByStatus(String status);

    @Query("SELECT * FROM chat_document_info WHERE document_type = :documentType ORDER BY upload_time DESC")
    Flux<ChatDocumentInfo> findByDocumentType(String documentType);

    @Query("SELECT * FROM chat_document_info WHERE document_name LIKE CONCAT('%', :name, '%') ORDER BY upload_time DESC")
    Flux<ChatDocumentInfo> findByDocumentNameContaining(String name);

    @Query("SELECT * FROM chat_document_info WHERE stuff_id = :stuffId ORDER BY upload_time DESC")
    Flux<ChatDocumentInfo> findByStuffId(String stuffId);

    @Query("SELECT * FROM chat_document_info ORDER BY upload_time DESC")
    Flux<ChatDocumentInfo> findAllOrderByUploadTimeDesc();

    @Query("SELECT * FROM chat_document_info WHERE job_id = :jobId")
    Mono<ChatDocumentInfo> findByJobId(String jobId);

    @Query("SELECT * FROM chat_document_info WHERE document_name = :documentName AND stuff_id = :stuffId")
    Mono<ChatDocumentInfo> findByDocumentNameAndStuffId(String documentName, String stuffId);

    @Query("UPDATE chat_document_info SET status = :status, update_time = CURRENT_TIMESTAMP WHERE job_id = :jobId")
    Mono<Integer> updateStatusByJobId(String jobId, String status);
}