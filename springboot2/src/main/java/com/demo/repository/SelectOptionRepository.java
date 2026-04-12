package com.demo.repository;

import com.demo.model.SelectOption;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SelectOptionRepository extends MongoRepository<SelectOption, String> {

    // 根据模块名称查询
    List<SelectOption> findByModule(String module);
}
