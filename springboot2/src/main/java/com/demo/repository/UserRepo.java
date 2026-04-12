package com.demo.repository;

import com.demo.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepo extends MongoRepository<User, String> {
    Optional<User> findByStaffId(String staffId);

    // 根据员工ID是否存在查询
    Boolean existsByStaffId(String staffId);

    // 分页查询所有用户
    Page<User> findAll(Pageable pageable);

    // 统计用户组的用户数
    long countByGroupIdsContaining(String groupId);

}
