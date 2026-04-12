package com.demo.repository;

import com.demo.model.FormResponse;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface FormResponseRepository extends MongoRepository<FormResponse, String> {

    Optional<FormResponse> findByFormIdAndCreatedBy(String requirementId, String staffId);

    // 按表单ID查找
    List<FormResponse> findByFormId(String formId);

    // 按创建时间排序查找
    List<FormResponse> findByFormIdOrderByCreatedAtDesc(String formId);


}
