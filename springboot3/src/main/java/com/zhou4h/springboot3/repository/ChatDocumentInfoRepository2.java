package com.zhou4h.springboot3.repository;

import com.zhou4h.springboot3.entity.ChatDocumentInfo;
import org.springframework.data.domain.Sort;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Repository
public interface ChatDocumentInfoRepository2 extends R2dbcRepository<ChatDocumentInfo, Long> {

    // 使用派生查询方法
    Flux<ChatDocumentInfo> findByStatusOrderByUploadTimeDesc(String status);

    Flux<ChatDocumentInfo> findByDocumentTypeOrderByUploadTimeDesc(String documentType);

    Flux<ChatDocumentInfo> findByDocumentNameContainingOrderByUploadTimeDesc(String name);

    Flux<ChatDocumentInfo> findByStuffIdOrderByUploadTimeDesc(String stuffId);

    // 使用 Sort 参数替代 SQL 排序
    Flux<ChatDocumentInfo> findAllBy(Sort sort);

    // 默认方法实现 findAllOrderByUploadTimeDesc
    default Flux<ChatDocumentInfo> findAllOrderByUploadTimeDesc() {
        return findAllBy(Sort.by(Sort.Direction.DESC, "uploadTime"));
    }

    Mono<ChatDocumentInfo> findByJobId(String jobId);

    // 使用自定义更新方法
    default Mono<Void> updateStatusByJobId(String jobId, String status) {
        return findByJobId(jobId)
                .flatMap(entity -> {
                    entity.setStatus(status);
                    entity.setUpdateTime(LocalDateTime.now());
                    return save(entity);
                })
                .then();
    }
}
